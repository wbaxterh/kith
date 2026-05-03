"""OpenAI TTS pipeline.

Uses the OpenAI API's text-to-speech endpoint. Supports models tts-1 and
tts-1-hd with voices: alloy, ash, ballad, coral, echo, fable, nova,
onyx, sage, shimmer.

Config keys:
  - apiKey: OpenAI API key (or OPENAI_API_KEY env)
  - voiceId: one of the OpenAI voice names (default: "nova")
  - modelId: "tts-1" or "tts-1-hd" (default: "tts-1")
  - speed: 0.25-4.0 (default: 1.0)
  - outputFormat: "mp3" | "opus" | "aac" | "flac" | "pcm" (default: "mp3")
"""

from __future__ import annotations

import asyncio
import base64
import os
import time
from collections.abc import Awaitable, Callable
from uuid import uuid4

from .envelope import (
    BargeInDetectedEvent,
    ErrorEvent,
    TtsAudioChunkEvent,
    TtsEndEvent,
    TtsStartEvent,
    TurnEndEvent,
    TurnStartEvent,
    WireEvent,
)

EventEmitter = Callable[[WireEvent], Awaitable[None]]


def _now_ms() -> int:
    return int(time.time() * 1000)


class OpenAITTSPipeline:
    """Pipeline that synthesizes text via OpenAI's TTS API."""

    DEFAULT_MODEL = "tts-1"
    DEFAULT_VOICE = "nova"
    DEFAULT_FORMAT = "mp3"

    def __init__(self, emit: EventEmitter) -> None:
        self._emit = emit
        self._api_key: str | None = None
        self._voice: str = self.DEFAULT_VOICE
        self._model: str = self.DEFAULT_MODEL
        self._speed: float = 1.0
        self._format: str = self.DEFAULT_FORMAT
        self._queue: asyncio.Queue[tuple[str, str | None]] = asyncio.Queue()
        self._worker: asyncio.Task[None] | None = None
        self._current: asyncio.Task[None] | None = None

    async def start(self, config: dict) -> None:
        self._api_key = config.get("openaiApiKey") or config.get("apiKey") or os.environ.get("OPENAI_API_KEY")
        if not self._api_key:
            raise RuntimeError("openai_tts pipeline requires openaiApiKey (or OPENAI_API_KEY env)")

        self._voice = config.get("openaiVoice") or config.get("voiceId") or self.DEFAULT_VOICE
        self._model = config.get("openaiModel") or self.DEFAULT_MODEL
        self._speed = float(config.get("speed", 1.0))
        self._format = config.get("openaiFormat") or self.DEFAULT_FORMAT
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

    async def handle_text(self, text: str, turn_id: str | None) -> None:
        await self._queue.put((text, turn_id))

    async def handle_audio(self, audio_b64: str, sample_rate: int) -> None:
        return None

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

    async def _worker_loop(self) -> None:
        while True:
            text, turn_id = await self._queue.get()
            tid = turn_id or f"t-{uuid4().hex[:8]}"
            self._current = asyncio.create_task(self._synthesize(tid, text))
            try:
                await self._current
            except asyncio.CancelledError:
                pass
            except Exception:
                pass
            self._current = None

    async def _synthesize(self, turn_id: str, text: str) -> None:
        try:
            await self._emit(
                TurnStartEvent(timestamp=_now_ms(), turn_id=turn_id, role="assistant"),
            )
            chunk_id = f"c-0"
            await self._emit(
                TtsStartEvent(timestamp=_now_ms(), turn_id=turn_id, chunk_id=chunk_id),
            )

            audio_bytes = await asyncio.to_thread(self._call_api, text)

            mime = "audio/mpeg" if self._format == "mp3" else f"audio/{self._format}"
            await self._emit(
                TtsAudioChunkEvent(
                    timestamp=_now_ms(),
                    turn_id=turn_id,
                    chunk_id=chunk_id,
                    audio_b64=base64.b64encode(audio_bytes).decode("ascii"),
                    mime_type=mime,
                ),
            )
            await self._emit(
                TtsEndEvent(timestamp=_now_ms(), turn_id=turn_id, chunk_id=chunk_id),
            )
            await self._emit(
                TurnEndEvent(timestamp=_now_ms(), turn_id=turn_id, role="assistant"),
            )
        except asyncio.CancelledError:
            await self._emit(
                BargeInDetectedEvent(timestamp=_now_ms(), turn_id=turn_id),
            )
            raise
        except Exception as exc:
            await self._emit(
                ErrorEvent(
                    timestamp=_now_ms(),
                    message=f"openai tts failed: {exc}",
                    retriable=True,
                ),
            )

    def _call_api(self, text: str) -> bytes:
        import requests

        resp = requests.post(
            "https://api.openai.com/v1/audio/speech",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self._model,
                "input": text,
                "voice": self._voice,
                "speed": self._speed,
                "response_format": self._format,
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.content
