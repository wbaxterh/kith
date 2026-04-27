# Kith

> *kith* (n., archaic) — one's friends, acquaintances, and kin; those who are familiar.

**Kith is a runtime-agnostic voice framework for AI companions.** It's the layer between your agent stack (LangGraph, custom orchestrators, or anything you've built) and the realtime voice infrastructure (Pipecat, LiveKit) — so any project can ship a companion that sounds natural, handles barge-in, and drives an avatar without rebuilding the stack from scratch.

[![npm](https://img.shields.io/npm/v/@kithjs/core?label=%40kithjs%2Fcore&color=blue)](https://www.npmjs.com/package/@kithjs/core)
[![npm](https://img.shields.io/npm/v/@kithjs/voice-router?label=%40kithjs%2Fvoice-router&color=blue)](https://www.npmjs.com/package/@kithjs/voice-router)
[![npm](https://img.shields.io/npm/v/@kithjs/runtime-pipecat?label=%40kithjs%2Fruntime-pipecat&color=blue)](https://www.npmjs.com/package/@kithjs/runtime-pipecat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install

```bash
# Core + Pipecat runtime + voice router (the typical setup)
bun add @kithjs/core @kithjs/runtime-pipecat @kithjs/voice-router

# Optional
bun add @kithjs/observability    # traces, dup-send guards, reconnect metrics
bun add @kithjs/avatar-events    # normalized avatar/expression events (v0.2)
bun add @kithjs/runtime-livekit  # LiveKit adapter (mock mode in v0.1)
```

Also works with npm/pnpm/yarn:

```bash
npm install @kithjs/core @kithjs/runtime-pipecat @kithjs/voice-router
```

## Quickstart

```ts
import { PipecatRuntime } from "@kithjs/runtime-pipecat";
import {
  DEFAULT_ENGLISH_SLANG,
  DEFAULT_GENZ_SLANG,
  DEFAULT_LAUGH_TAGS,
  VoiceRouter,
} from "@kithjs/voice-router";

const runtime = new PipecatRuntime({
  pythonPath: ".venv/bin/python",
  cwd: "./python",
  config: {
    pipeline: "elevenlabs",
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    modelId: "eleven_v3",
    stability: 0.5,
    similarityBoost: 0.85,
    style: 0.4,
  },
});

await runtime.connect({ sessionId: "my-session" });

const voice = new VoiceRouter({
  runtime,
  slang: { ...DEFAULT_ENGLISH_SLANG, ...DEFAULT_GENZ_SLANG, ...DEFAULT_LAUGH_TAGS },
});

// Subscribe to events
voice.on((event) => {
  if (event.type === "tts_audio_chunk") {
    // Forward audio to browser / speaker
  }
  if (event.type === "emotion_state") {
    // Tint avatar, trigger animation
  }
});

// Speak — text is chunked at sentence boundaries, slang expanded,
// emojis converted to emotion events, and laugh tags rendered as real laughter
await voice.speak("Hey! That trick was fire 🔥 haha let's gooo!");
```

## Why

Today, if you want voice on your AI companion you either:

1. **Glue TTS onto a text stream** and accept robotic, fragment-synthesized audio — or
2. **Wire a realtime voice stack yourself** (VAD, barge-in, turn detection, provider routing, chunking, pacing, visemes) for every project.

Neither scales. Kith is the missing layer: **stable adapter contracts** around a Pipecat runtime, with LiveKit as a second adapter so your app isn't locked to either. You keep your agent, your persona, your memory; Kith owns the voice loop.

## Architecture (v0.1)

```
your agent  <-->  @kithjs/core  <-->  runtime adapter  <-->  Pipecat | LiveKit
                      |
            voice / memory / expression / observability adapters
```

### Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@kithjs/core`](https://www.npmjs.com/package/@kithjs/core) | Stable adapter contracts, event bus, policy hooks | [![npm](https://img.shields.io/npm/v/@kithjs/core)](https://www.npmjs.com/package/@kithjs/core) |
| [`@kithjs/runtime-pipecat`](https://www.npmjs.com/package/@kithjs/runtime-pipecat) | Primary runtime — TS facade over Python Pipecat sidecar | [![npm](https://img.shields.io/npm/v/@kithjs/runtime-pipecat)](https://www.npmjs.com/package/@kithjs/runtime-pipecat) |
| [`@kithjs/runtime-livekit`](https://www.npmjs.com/package/@kithjs/runtime-livekit) | LiveKit adapter (mock mode in v0.1, full WebRTC in v0.2) | [![npm](https://img.shields.io/npm/v/@kithjs/runtime-livekit)](https://www.npmjs.com/package/@kithjs/runtime-livekit) |
| [`@kithjs/voice-router`](https://www.npmjs.com/package/@kithjs/voice-router) | Sentence-aware chunking, slang expansion, emoji-to-emotion, pronunciation, VoiceCharacter profiles | [![npm](https://img.shields.io/npm/v/@kithjs/voice-router)](https://www.npmjs.com/package/@kithjs/voice-router) |
| [`@kithjs/avatar-events`](https://www.npmjs.com/package/@kithjs/avatar-events) | Normalized avatar/expression event stream (v0.2 utilities) | [![npm](https://img.shields.io/npm/v/@kithjs/avatar-events)](https://www.npmjs.com/package/@kithjs/avatar-events) |
| [`@kithjs/observability`](https://www.npmjs.com/package/@kithjs/observability) | Traces, dup-send guards, reconnect metrics | [![npm](https://img.shields.io/npm/v/@kithjs/observability)](https://www.npmjs.com/package/@kithjs/observability) |

## Documentation

- **[Tutorial: Build your first companion in 15 minutes](docs/tutorial.md)**
- [Architecture](docs/architecture.md) — system diagram, adapter contracts, event bus
- [Protocol](docs/protocol.md) — TS to Python JSON envelope spec
- [Phase 1 Planning](docs/phase-1-planning.md) — v0.1 scope and decisions
- [Changelog](CHANGELOG.md)

## Roadmap

| Version | Status | Highlights |
|---------|--------|------------|
| **v0.1** | Shipped | Core contracts, Pipecat runtime with ElevenLabs TTS + auto-respawn, VoiceRouter (sentence chunking, emoji-to-emotion, slang/pronunciation, VoiceCharacter profiles, laugh tags), observability, reference web demo |
| **v0.2** | Next | LiveKit production adapter, Cartesia + OpenAI TTS providers with fallback, VRM + phoneme-to-viseme lipsync, mic input / STT round-trip |
| **v0.3+** | Planned | React Native support, telephony (SIP/PSTN), multi-agent orchestration, pluggable memory backends |

## Non-goals

- **Replacing your agent runtime.** Kith sits *beside* your agent, not *inside* it.
- **Reimplementing memory/RAG.** `MemoryAdapter` is pass-through — you own storage.
- **Owning the avatar renderer.** Kith emits events (`viseme_frame`, `emotion_state`); your app renders however it wants.

## Contributing

v0.1 API surface is stable for consumers. If you hit a rough edge or a bug, file an issue. External PRs for v0.2 items (provider adapters, LiveKit runtime, VRM avatars) are welcome once v0.1 interfaces settle in real use.

## License

[MIT](LICENSE)
