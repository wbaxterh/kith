"""Fallback pipeline — tries providers in order until one succeeds.

Usage via config:
  {
    "pipeline": "fallback",
    "providers": ["elevenlabs", "openai_tts", "cartesia"],
    "apiKey": "...",          // ElevenLabs
    "openaiApiKey": "...",    // OpenAI
    "cartesiaApiKey": "...",  // Cartesia
    ...
  }

On each `handle_text` call, the fallback pipeline tries the primary
provider. If it raises, it falls through to the next. Once a provider
succeeds for a chunk, the remaining providers are skipped for that chunk.

The fallback pipeline also tracks failure counts. If the primary has
failed 3+ times in a row, it preemptively skips to the next provider
for faster response times (circuit breaker pattern).
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from uuid import uuid4

from .envelope import (
    ErrorEvent,
    TurnEndEvent,
    TurnStartEvent,
    WireEvent,
)

EventEmitter = Callable[[WireEvent], Awaitable[None]]


def _now_ms() -> int:
    return int(time.time() * 1000)


class FallbackPipeline:
    """Wraps multiple TTS pipelines and falls back through them in order."""

    MAX_CONSECUTIVE_FAILURES = 3
    CIRCUIT_RESET_SECONDS = 60

    def __init__(self, emit: EventEmitter) -> None:
        self._emit = emit
        self._pipelines: list[tuple[str, object]] = []
        self._failure_counts: dict[str, int] = {}
        self._last_failure_time: dict[str, float] = {}
        self._queue: asyncio.Queue[tuple[str, str | None]] = asyncio.Queue()
        self._worker: asyncio.Task[None] | None = None
        self._current: asyncio.Task[None] | None = None

    async def start(self, config: dict) -> None:
        from .server import _PIPELINES

        providers = config.get("providers", ["elevenlabs", "openai_tts"])

        for name in providers:
            if name == "fallback":
                continue  # prevent infinite recursion
            pipeline_cls = _PIPELINES.get(name)
            if pipeline_cls is None:
                continue

            pipeline = pipeline_cls(self._emit)
            try:
                await pipeline.start(config)
                self._pipelines.append((name, pipeline))
                self._failure_counts[name] = 0
            except Exception as exc:
                # Provider can't start (missing API key, etc) — skip it
                print(f"[fallback] {name} failed to start: {exc}", flush=True)

        if not self._pipelines:
            raise RuntimeError("fallback pipeline: no providers could start")

        print(
            f"[fallback] initialized with {len(self._pipelines)} providers: "
            f"{[n for n, _ in self._pipelines]}",
            flush=True,
        )
        self._worker = asyncio.create_task(self._worker_loop())

    async def stop(self) -> None:
        await self.barge_in()
        if self._worker is not None:
            self._worker.cancel()
            try:
                await self._worker
            except (asyncio.CancelledError, Exception):
                pass
            self._worker = None

        for _name, pipeline in self._pipelines:
            try:
                await pipeline.stop()
            except Exception:
                pass

    async def handle_text(self, text: str, turn_id: str | None) -> None:
        await self._queue.put((text, turn_id))

    async def handle_audio(self, audio_b64: str, sample_rate: int) -> None:
        for _name, pipeline in self._pipelines:
            try:
                await pipeline.handle_audio(audio_b64, sample_rate)
                return
            except Exception:
                continue

    async def barge_in(self) -> None:
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        task = self._current
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
        self._current = None
        # Also barge-in on all sub-pipelines
        for _name, pipeline in self._pipelines:
            try:
                await pipeline.barge_in()
            except Exception:
                pass

    async def _worker_loop(self) -> None:
        while True:
            text, turn_id = await self._queue.get()
            tid = turn_id or f"t-{uuid4().hex[:8]}"
            self._current = asyncio.create_task(self._synthesize_with_fallback(tid, text))
            try:
                await self._current
            except asyncio.CancelledError:
                pass
            except Exception:
                pass
            self._current = None

    def _is_circuit_open(self, name: str) -> bool:
        """Check if a provider's circuit breaker is open (too many failures)."""
        count = self._failure_counts.get(name, 0)
        if count < self.MAX_CONSECUTIVE_FAILURES:
            return False
        # Check if enough time has passed to retry
        last_fail = self._last_failure_time.get(name, 0)
        if time.time() - last_fail > self.CIRCUIT_RESET_SECONDS:
            self._failure_counts[name] = 0
            return False
        return True

    async def _synthesize_with_fallback(self, turn_id: str, text: str) -> None:
        last_error = None

        for name, pipeline in self._pipelines:
            if self._is_circuit_open(name):
                continue

            try:
                await pipeline.handle_text(text, turn_id)
                # Success — reset failure count
                self._failure_counts[name] = 0
                return
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self._failure_counts[name] = self._failure_counts.get(name, 0) + 1
                self._last_failure_time[name] = time.time()
                last_error = exc
                print(
                    f"[fallback] {name} failed (attempt {self._failure_counts[name]}): {exc}",
                    flush=True,
                )
                continue

        # All providers failed
        await self._emit(
            ErrorEvent(
                timestamp=_now_ms(),
                message=f"all TTS providers failed. last error: {last_error}",
                retriable=False,
            ),
        )
