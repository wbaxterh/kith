"""Local TTS pipeline backed by Voxtral (Mistral).

Voxtral is a 3B-parameter open-weight TTS model that runs locally with
voice cloning from 3-5 seconds of audio. Requires a GPU with 16GB+ VRAM
(or Apple Silicon with 16GB+ via MLX quantized version).

Install: pip install mistral-common vllm (for GPU) or mlx-lm (for Apple Silicon)

Config keys:
  - voxtralModel: model path or HF repo (default: "mistralai/Voxtral-Mini-3B-2507")
  - voxtralVoice: preset voice name or path to reference audio file for cloning
  - voxtralBackend: "vllm" | "mlx" | "api" (default: auto-detect)
  - voxtralApiKey: Mistral API key (only for backend="api")
  - voxtralLanguage: language code (default: "en")
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


class VoxtralPipeline:
    """Pipeline that synthesizes text locally via Voxtral TTS.

    Supports three backends:
    - vllm: NVIDIA GPU (16GB+ VRAM). Best quality.
    - mlx: Apple Silicon (16GB+). Fastest local option on Mac.
    - api: Mistral Cloud API. No local GPU needed but requires API key.
    """

    DEFAULT_MODEL = "mistralai/Voxtral-Mini-3B-2507"

    def __init__(self, emit: EventEmitter) -> None:
        self._emit = emit
        self._backend: str = "api"  # default to API for widest compatibility
        self._model: str = self.DEFAULT_MODEL
        self._voice: str | None = None
        self._api_key: str | None = None
        self._language: str = "en"
        self._client = None
        self._queue: asyncio.Queue[tuple[str, str | None]] = asyncio.Queue()
        self._worker: asyncio.Task[None] | None = None
        self._current: asyncio.Task[None] | None = None

    async def start(self, config: dict) -> None:
        self._model = config.get("voxtralModel") or self.DEFAULT_MODEL
        self._voice = config.get("voxtralVoice") or "aria"  # default preset
        self._language = config.get("voxtralLanguage") or "en"
        self._backend = config.get("voxtralBackend") or self._detect_backend()

        if self._backend == "api":
            self._api_key = (
                config.get("voxtralApiKey")
                or config.get("mistralApiKey")
                or os.environ.get("MISTRAL_API_KEY")
            )
            if not self._api_key:
                raise RuntimeError(
                    "voxtral API backend requires voxtralApiKey or MISTRAL_API_KEY env"
                )
            try:
                from mistralai import Mistral
                self._client = Mistral(api_key=self._api_key)
            except ImportError:
                raise RuntimeError("mistralai package not installed. Run: pip install mistralai")

        elif self._backend == "vllm":
            print("[voxtral] using vLLM backend (GPU)", flush=True)
            # vLLM initialization happens in _synthesize_vllm on first call

        elif self._backend == "mlx":
            print("[voxtral] using MLX backend (Apple Silicon)", flush=True)
            # MLX initialization happens in _synthesize_mlx on first call

        print(f"[voxtral] initialized: model={self._model}, backend={self._backend}, voice={self._voice}", flush=True)
        self._worker = asyncio.create_task(self._worker_loop())

    def _detect_backend(self) -> str:
        """Auto-detect best available backend."""
        try:
            import torch
            if torch.cuda.is_available():
                return "vllm"
        except ImportError:
            pass

        try:
            import mlx
            return "mlx"
        except ImportError:
            pass

        return "api"

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

            if self._backend == "api":
                audio_bytes = await asyncio.to_thread(self._synthesize_api, text)
            elif self._backend == "vllm":
                audio_bytes = await asyncio.to_thread(self._synthesize_vllm, text)
            elif self._backend == "mlx":
                audio_bytes = await asyncio.to_thread(self._synthesize_mlx, text)
            else:
                raise RuntimeError(f"unknown voxtral backend: {self._backend}")

            await self._emit(
                TtsAudioChunkEvent(
                    timestamp=_now_ms(),
                    turn_id=turn_id,
                    chunk_id=chunk_id,
                    audio_b64=base64.b64encode(audio_bytes).decode("ascii"),
                    mime_type="audio/wav",
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
                    message=f"voxtral tts failed: {exc}",
                    retriable=True,
                ),
            )

    def _synthesize_api(self, text: str) -> bytes:
        """Synthesize via Mistral Cloud API."""
        import requests

        resp = requests.post(
            "https://api.mistral.ai/v1/audio/speech",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "voxtral-mini",
                "input": text,
                "voice": self._voice,
                "response_format": "wav",
                "language": self._language,
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.content

    def _synthesize_vllm(self, text: str) -> bytes:
        """Synthesize locally via vLLM (NVIDIA GPU)."""
        # Lazy import and initialization
        try:
            from vllm import LLM
            if not hasattr(self, "_vllm_model"):
                print(f"[voxtral] loading model via vLLM: {self._model}", flush=True)
                self._vllm_model = LLM(model=self._model)
            output = self._vllm_model.generate_audio(text, voice=self._voice)
            return output.audio_bytes
        except ImportError:
            raise RuntimeError("vllm not installed. Run: pip install vllm")
        except Exception as exc:
            raise RuntimeError(f"vLLM synthesis failed: {exc}")

    def _synthesize_mlx(self, text: str) -> bytes:
        """Synthesize locally via MLX (Apple Silicon)."""
        try:
            import subprocess
            import tempfile

            # Use mlx_lm CLI for simplest integration
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                out_path = f.name

            subprocess.run(
                [
                    "python", "-m", "mlx_lm.tts",
                    "--model", self._model,
                    "--text", text,
                    "--voice", self._voice or "aria",
                    "--output", out_path,
                ],
                capture_output=True,
                check=True,
                timeout=60,
            )

            with open(out_path, "rb") as f:
                audio = f.read()
            os.unlink(out_path)
            return audio
        except ImportError:
            raise RuntimeError("mlx-lm not installed. Run: pip install mlx-lm")
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(f"MLX synthesis failed: {exc.stderr.decode()}")
