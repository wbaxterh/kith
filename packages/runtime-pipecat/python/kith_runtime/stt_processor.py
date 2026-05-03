"""Speech-to-text processor.

Receives audio chunks from the browser (via sendAudio ops), buffers them,
and runs STT transcription. Supports Deepgram (streaming) and OpenAI Whisper
(batch) as backends.

Design: the STT processor runs independently of the TTS pipeline. Audio
arrives, gets buffered, and when silence is detected (or a flush is forced),
the buffer is transcribed and stt_partial / stt_final events are emitted.

Config keys:
  - sttProvider: "deepgram" | "whisper" (default: "whisper")
  - deepgramApiKey: Deepgram API key (or DEEPGRAM_API_KEY env)
  - openaiApiKey: OpenAI API key for Whisper (or OPENAI_API_KEY env)
  - sttLanguage: language hint (default: "en")
  - vadSilenceMs: silence duration in ms to trigger transcription (default: 800)
"""

from __future__ import annotations

import asyncio
import base64
import os
import time
from collections.abc import Awaitable, Callable
from uuid import uuid4

from .envelope import (
    ErrorEvent,
    SttFinalEvent,
    SttPartialEvent,
    TurnEndEvent,
    TurnStartEvent,
    WireEvent,
)

EventEmitter = Callable[[WireEvent], Awaitable[None]]


def _now_ms() -> int:
    return int(time.time() * 1000)


class SttProcessor:
    """Buffers audio and runs STT when silence is detected."""

    def __init__(self, emit: EventEmitter) -> None:
        self._emit = emit
        self._provider: str = "whisper"
        self._api_key: str | None = None
        self._language: str = "en"
        self._vad_silence_ms: int = 800
        self._buffer: bytearray = bytearray()
        self._last_audio_time: float = 0
        self._current_turn_id: str | None = None
        self._silence_task: asyncio.Task[None] | None = None
        self._started = False

    async def start(self, config: dict) -> None:
        self._provider = config.get("sttProvider", "whisper")
        self._language = config.get("sttLanguage", "en")
        self._vad_silence_ms = int(config.get("vadSilenceMs", 800))

        if self._provider == "deepgram":
            self._api_key = (
                config.get("deepgramApiKey")
                or os.environ.get("DEEPGRAM_API_KEY")
            )
            if not self._api_key:
                print("[stt] deepgram requires deepgramApiKey — falling back to whisper", flush=True)
                self._provider = "whisper"

        if self._provider == "whisper":
            self._api_key = (
                config.get("openaiApiKey")
                or config.get("apiKey")
                or os.environ.get("OPENAI_API_KEY")
            )
            if not self._api_key:
                print("[stt] whisper requires openaiApiKey — STT disabled", flush=True)
                return

        self._started = True
        print(f"[stt] initialized with provider={self._provider}", flush=True)

    async def stop(self) -> None:
        if self._silence_task and not self._silence_task.done():
            self._silence_task.cancel()
        self._buffer.clear()
        self._started = False

    async def handle_audio(self, audio_b64: str, sample_rate: int) -> None:
        if not self._started:
            return

        audio_bytes = base64.b64decode(audio_b64)
        self._buffer.extend(audio_bytes)
        self._last_audio_time = time.time()

        # Start a new turn if needed
        if self._current_turn_id is None:
            self._current_turn_id = f"user-{uuid4().hex[:8]}"
            await self._emit(
                TurnStartEvent(
                    timestamp=_now_ms(),
                    turn_id=self._current_turn_id,
                    role="user",
                ),
            )

        # Reset the silence timer
        if self._silence_task and not self._silence_task.done():
            self._silence_task.cancel()
        self._silence_task = asyncio.create_task(
            self._wait_for_silence()
        )

    async def _wait_for_silence(self) -> None:
        """Wait for silence, then flush the buffer for transcription."""
        await asyncio.sleep(self._vad_silence_ms / 1000.0)

        # Check that no new audio arrived during the wait
        elapsed = (time.time() - self._last_audio_time) * 1000
        if elapsed < self._vad_silence_ms * 0.8:
            return  # more audio came in, wait again

        await self._flush()

    async def _flush(self) -> None:
        if not self._buffer or not self._current_turn_id:
            return

        turn_id = self._current_turn_id
        audio_data = bytes(self._buffer)
        self._buffer.clear()
        self._current_turn_id = None

        try:
            text = await asyncio.to_thread(self._transcribe, audio_data)
            if text and text.strip():
                await self._emit(
                    SttFinalEvent(
                        timestamp=_now_ms(),
                        turn_id=turn_id,
                        text=text.strip(),
                    ),
                )
            await self._emit(
                TurnEndEvent(
                    timestamp=_now_ms(),
                    turn_id=turn_id,
                    role="user",
                ),
            )
        except Exception as exc:
            await self._emit(
                ErrorEvent(
                    timestamp=_now_ms(),
                    message=f"stt failed: {exc}",
                    retriable=True,
                ),
            )

    def _transcribe(self, audio_data: bytes) -> str:
        if self._provider == "whisper":
            return self._transcribe_whisper(audio_data)
        elif self._provider == "deepgram":
            return self._transcribe_deepgram(audio_data)
        return ""

    def _transcribe_whisper(self, audio_data: bytes) -> str:
        """Transcribe using OpenAI Whisper API."""
        import requests

        # Wrap raw PCM in a WAV header for the API
        wav_data = _pcm_to_wav(audio_data, sample_rate=16000, channels=1, bits=16)

        resp = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {self._api_key}"},
            files={"file": ("audio.wav", wav_data, "audio/wav")},
            data={"model": "whisper-1", "language": self._language},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("text", "")

    def _transcribe_deepgram(self, audio_data: bytes) -> str:
        """Transcribe using Deepgram Nova API."""
        import requests

        resp = requests.post(
            f"https://api.deepgram.com/v1/listen?model=nova-3&language={self._language}",
            headers={
                "Authorization": f"Token {self._api_key}",
                "Content-Type": "audio/l16;rate=16000;channels=1",
            },
            data=audio_data,
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
        alternatives = (
            result.get("results", {})
            .get("channels", [{}])[0]
            .get("alternatives", [{}])
        )
        return alternatives[0].get("transcript", "") if alternatives else ""


def _pcm_to_wav(pcm: bytes, sample_rate: int = 16000, channels: int = 1, bits: int = 16) -> bytes:
    """Wrap raw PCM bytes in a minimal WAV header."""
    import struct

    data_size = len(pcm)
    byte_rate = sample_rate * channels * (bits // 8)
    block_align = channels * (bits // 8)

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,              # chunk size
        1,               # PCM format
        channels,
        sample_rate,
        byte_rate,
        block_align,
        bits,
        b"data",
        data_size,
    )
    return header + pcm
