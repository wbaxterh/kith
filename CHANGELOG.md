# Changelog

All notable changes to this repository. Format loosely follows [Keep a Changelog](https://keepachangelog.com/); semver applies to each `@kith/*` package independently once we start publishing.

## [0.1.0] — 2026-04-22

Initial public release. The framework works end-to-end for one runtime (Pipecat + ElevenLabs) and one reference consumer (the web demo). API surface is stable; deferred items (see `docs/phase-1-planning.md` §3) land in v0.2.

### Added — `@kith/core`

- `RuntimeAdapter`, `VoiceAdapter`, `MemoryAdapter`, `ExpressionAdapter`, `ObservabilityAdapter` contracts
- `KithEvent` union covering turn lifecycle, TTS lifecycle including `tts_audio_chunk`, STT partial/final, viseme frames, emotion state, barge-in, reconnect, error
- `TurnRecord`, `VoiceOptions`, `VoiceDescriptor`, `RuntimeConfig`, `SlangDict`, `PronunciationDict`, `PersonaMode`, `TextTransform` types

### Added — `@kith/runtime-pipecat`

- `PipecatRuntime` class implementing `RuntimeAdapter`
- Python sidecar (`python/kith_runtime/`) speaking JSON-over-WebSocket per `docs/protocol.md`
- Mock pipeline for tests, real ElevenLabs pipeline for production
- Queue-based text handling — sequential synthesis without spurious barge-ins
- Automatic sidecar respawn on unexpected exit, emits `reconnect` events with bounded exponential backoff

### Added — `@kith/voice-router`

- Sentence-aware chunker — holds tails until terminal punctuation + whitespace, streaming-safe
- Pronunciation + slang layers with whole-word, case-preserving substitution
- Emoji → emotion translation with polarity-aware aggregation (mixed-valence posts classified by dominant polarity, not single highest hint)
- Exported default dicts: `DEFAULT_EMOJI_MAP`, `DEFAULT_ENGLISH_SLANG`, `DEFAULT_GENZ_SLANG`, `DEFAULT_BOARD_SPORTS_SLANG`, `DEFAULT_LAUGH_TAGS` (requires `eleven_v3`)
- `VoiceCharacter` profile type + `applyVoiceCharacter` helper for hot-swaps
- Dedupe window to guard against double-sends

### Added — `@kith/observability`

- `InMemoryObservability` implementing the `ObservabilityAdapter` contract
- Spans with attribute bags + duration tracking
- `guardDupSend` sliding-window duplicate detection
- `onRecord` subscription for OpenTelemetry bridges or external exporters
- `consoleExporter` convenience for dev

### Added — `apps/demo-web`

- Bun server with per-session `PipecatRuntime` + `VoiceRouter`
- Single-file browser client with canvas avatar, Web Audio playback, state + emotion tints
- Default model: `eleven_v3`
- Composes all shipped slang dicts + `examples/companion-slang-skate.json`

### Added — docs

- `docs/tutorial.md` — 15-minute fresh-machine walkthrough
- `docs/architecture.md` — system diagram, package map, adapter summaries, event bus table, consumer integration shape
- `docs/protocol.md` — TS ↔ Python JSON envelope contract
- `examples/README.md` + `examples/voice-profile.json` — composing character profiles
- `CLAUDE.md` — agentic development conventions

### Deferred to v0.2

- `@kith/runtime-livekit` — portability stub
- `@kith/avatar-events` — renderer utilities beyond event emission (events themselves live in `@kith/core`)
- Multi-provider voice router (Cartesia + OpenAI TTS adapters with fallback)
- Real VRM avatar + phoneme-to-viseme lipsync
- Microphone input / STT round-trip

See [`docs/phase-1-planning.md`](docs/phase-1-planning.md) §3 for the rationale and §4 for the full schedule that drove this release.
