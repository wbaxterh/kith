---
sidebar_position: 1
---

# @kithjs/core

[![npm](https://img.shields.io/npm/v/@kithjs/core)](https://www.npmjs.com/package/@kithjs/core)

Stable adapter contracts, event types, and policy hooks. This is the foundation package — all other Kith packages depend on it.

## Install

```bash
bun add @kithjs/core
```

## What's Inside

### Adapter Interfaces

- **`RuntimeAdapter`** — connect/disconnect, sendText, sendAudio, bargeIn, event subscription
- **`VoiceAdapter`** — TTS synthesis and voice listing
- **`MemoryAdapter`** — fetch/save turn records (pass-through)
- **`ExpressionAdapter`** — subscribe to avatar/expression events
- **`ObservabilityAdapter`** — traces, dup-send guards, reconnect tracking

### Event Types (`KithEvent`)

12 normalized events: `turn_start`, `turn_end`, `tts_start`, `tts_audio_chunk`, `tts_end`, `stt_partial`, `stt_final`, `viseme_frame`, `emotion_state`, `barge_in_detected`, `reconnect`, `error`.

See [Event Bus](/docs/concepts/event-bus) for the full reference.

### Types

- `TurnId`, `ChunkId`, `SessionId` — opaque string identifiers
- `TurnRecord` — a single conversational turn
- `RuntimeConfig` — session connection config
- `VoiceOptions` — provider-agnostic TTS knobs
- `VoiceDescriptor` — voice metadata

### Policy

- `TextTransform` — `(text: string, ctx: TextTransformContext) => string`
- `PersonaMode` — `"neutral" | "hype" | "calm" | "serious"` (extensible via string)
