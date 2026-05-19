"""Local TTS pipeline backed by Piper.

Piper is a fast, CPU-friendly TTS engine that produces natural speech
without any cloud API. Runs on Raspberry Pi-class hardware.

Install: pip install piper-tts
Models: https://github.com/rhasspy/piper/blob/master/VOICES.md

Config keys:
  - piperModel: path to .onnx model file (or model name for auto-download)
  - piperDataDir: directory for model cache (default: ~/.local/share/piper)
  - piperSpeaker: speaker ID for multi-speaker models (default: 0)
  - outputFormat: "wav" | "mp3" (default: "wav")
"""

from __future__ import annotations

import asyncio
import base64
import io
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


class PiperPipeline:
    """Pipeline that synthesizes text locally via Piper TTS. No cloud API needed."""

    def __init__(self, emit: EventEmitter) -> None:
        self._emit = emit
        self._voice = None
        self._synthesize_fn = None
        self._model_path: str | None = None
        self._speaker: int = 0
        self._output_format: str = "wav"
        self._queue: asyncio.Queue[tuple[str, str | None]] = asyncio.Queue()
        self._worker: asyncio.Task[None] | None = None
        self._current: asyncio.Task[None] | None = None

    async def start(self, config: dict) -> None:
        model = config.get("piperModel") or os.environ.get("PIPER_MODEL")
        if not model:
            raise RuntimeError(
                "piper pipeline requires piperModel config or PIPER_MODEL env. "
                "Download a model from https://github.com/rhasspy/piper/blob/master/VOICES.md"
            )

        self._model_path = model
        self._speaker = int(config.get("piperSpeaker", 0))
        self._output_format = config.get("outputFormat", "wav")
        data_dir = config.get("piperDataDir") or os.environ.get(
            "PIPER_DATA_DIR", os.path.expanduser("~/.local/share/piper")
        )

        # Import and initialize Piper (lazy — only if this pipeline is selected)
        try:
            from piper import PiperVoice

            self._voice = PiperVoice.load(model, config_path=None, use_cuda=False)
            print(f"[piper] loaded model: {model}", flush=True)
        except ImportError:
            raise RuntimeError(
                "piper-tts not installed. Run: pip install piper-tts"
            )
        except Exception as exc:
            raise RuntimeError(f"piper model load failed: {exc}")

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

            audio_bytes = await asyncio.to_thread(self._synthesize_blocking, text)

            mime = "audio/wav"
            if self._output_format == "mp3":
                # Convert WAV to MP3 if requested
                audio_bytes = _wav_to_mp3(audio_bytes)
                mime = "audio/mpeg"

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
                    message=f"piper tts failed: {exc}",
                    retriable=False,
                ),
            )

    def _synthesize_blocking(self, text: str) -> bytes:
        """Run Piper synthesis in a thread (blocking call)."""
        buf = io.BytesIO()
        import wave

        with wave.open(buf, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)  # 16-bit
            wav.setframerate(22050)
            self._voice.synthesize(text, wav, speaker_id=self._speaker)

        return buf.getvalue()


def _wav_to_mp3(wav_bytes: bytes) -> bytes:
    """Convert WAV to MP3 using ffmpeg if available, otherwise return WAV."""
    import subprocess
    import tempfile

    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wf:
            wf.write(wav_bytes)
            wav_path = wf.name
        mp3_path = wav_path.replace(".wav", ".mp3")
        subprocess.run(
            ["ffmpeg", "-y", "-i", wav_path, "-q:a", "2", mp3_path],
            capture_output=True,
            check=True,
            timeout=30,
        )
        with open(mp3_path, "rb") as f:
            return f.read()
    except (FileNotFoundError, subprocess.CalledProcessError):
        # ffmpeg not available — return WAV
        return wav_bytes
    finally:
        for p in [wav_path, mp3_path]:
            try:
                os.unlink(p)
            except Exception:
                pass
