---
sidebar_position: 100
---

# Roadmap

Kith's development is planned in three phases. v0.1 is shipped and published on npm.

## v0.1 — Shipped

The foundation. Everything needed to ship a voice companion with natural-sounding TTS.

- **`@kithjs/core`** — 5 adapter contracts, 12-event normalized bus, policy hooks
- **`@kithjs/runtime-pipecat`** — Python Pipecat sidecar with auto-respawn, barge-in, full event emission
- **`@kithjs/runtime-livekit`** — Mock-mode portability stub (proves adapter contract works across runtimes)
- **`@kithjs/voice-router`** — Sentence-aware chunking, 4 default slang dicts, pronunciation overrides, emoji-to-emotion, VoiceCharacter profiles, ElevenLabs v3 laugh tags
- **`@kithjs/observability`** — Span tracing, duplicate-send guards, reconnect metrics
- **`@kithjs/avatar-events`** — Placeholder (events live in core; renderer utilities in v0.2)
- **Reference demo** — Working web app with procedural avatar

## v0.2 — Next

Production-grade voice quality and real avatar integration.

| Feature | Description |
|---------|-------------|
| **LiveKit production adapter** | Full WebRTC integration replacing mock mode |
| **Multi-provider TTS** | Cartesia + OpenAI TTS with automatic fallback |
| **VRM avatar utilities** | Three.js VRM loading, phoneme-to-viseme mapping, blend shapes |
| **Mic input / STT** | Full duplex — user speaks, Kith transcribes, agent responds |
| **React Native support** | LiveKit RN SDK path for mobile companions |

## v0.3+ — Planned

Scale and platform expansion.

| Feature | Description |
|---------|-------------|
| **Telephony** | SIP/PSTN via LiveKit for phone-based companions |
| **Multi-agent orchestration** | Multiple companions in the same voice session |
| **Pluggable memory backends** | First-party adapters for common vector stores |
| **Streaming LLM integration** | `voice.streamText(tokenIterator)` for real-time LLM output |
| **Voice cloning pipeline** | Character voice training workflow |

## Non-Goals

These are intentionally out of scope for Kith at any version:

- **Replacing your agent runtime.** Kith sits beside your agent (LangGraph, custom orchestrator, etc.), not inside it.
- **Reimplementing memory/RAG.** The `MemoryAdapter` is pass-through. You own your storage.
- **Owning the avatar renderer.** Kith emits events; your app renders however it wants (Three.js, Unity, 2D canvas, whatever).

## Contributing

v0.1 API surface is stable. Issues and PRs welcome, especially for:
- Provider adapters (Cartesia, OpenAI TTS, Deepgram)
- LiveKit production adapter
- VRM avatar utilities
- Bug reports from real integrations
