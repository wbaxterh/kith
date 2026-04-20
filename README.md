# Kith

> *kith* (n., archaic) — one's friends, acquaintances, and kin; those who are familiar.

**Kith is a runtime-agnostic voice framework for AI companions.** It's the layer between your agent stack (LangGraph, custom orchestrators, or anything you've built) and the realtime voice infrastructure (Pipecat, LiveKit) — so any project can ship a companion that sounds natural, handles barge-in, and drives an avatar without rebuilding the stack from scratch.

## Why

Today, if you want voice on your AI companion you either:

1. Glue TTS onto a text streaming output and accept robotic, fragment-synthesized audio — or
2. Wire a realtime voice stack yourself (VAD, barge-in, turn detection, provider routing, chunking, pacing, visemes) for every project.

Neither scales. Kith is the missing layer: **stable adapter contracts** around a Pipecat runtime, with LiveKit as a second adapter so your app isn't locked to either. You keep your agent, your persona, your memory; Kith owns the voice loop.

## Architecture (v0.1)

```
your agent  ←→  @kith/core  ←→  runtime adapter  ←→  Pipecat | LiveKit
                    ↕
          voice / memory / expression / observability adapters
```

- **`@kith/core`** — TypeScript facade. Stable contracts, event bus, policy hooks.
- **`@kith/runtime-pipecat`** — primary adapter. Spawns Pipecat as a Python sidecar; speaks JSON over WebSocket. Clean language boundary, full pipeline composability.
- **`@kith/runtime-livekit`** — secondary adapter (v0.1 stub). Validates portability.
- **`@kith/voice-router`** — provider routing (ElevenLabs, Cartesia, OpenAI TTS), pronunciation overrides, sentence-aware chunking, pacing.
- **`@kith/avatar-events`** — normalized event stream: `viseme_frame`, `emotion_state`, `turn_state`. Your renderer consumes it.
- **`@kith/observability`** — traces, dup-send guards, reconnect metrics.

## Status

**Pre-alpha. Phase 1 planning.** No code yet. The architecture, scope, and 2-week build plan live in [`docs/phase-1-planning.md`](docs/phase-1-planning.md).

## Roadmap

- **v0.1** (2 weeks) — `@kith/core` interfaces, Pipecat runtime, voice-router with sentence chunking, policy engine, web demo with procedural avatar, LiveKit adapter stub, docs.
- **v0.2** — full VRM + phoneme-to-viseme lipsync, React Native support, observability beyond traces.
- **v0.3+** — telephony (SIP/PSTN via LiveKit), multi-agent orchestration, pluggable memory backends.

## Non-goals (at least through v0.1)

- Replacing your agent runtime (Kith sits *beside* it, not *inside* it).
- Reimplementing memory/RAG — `MemoryAdapter` is pass-through.
- Owning the avatar renderer — Kith emits events; your app renders.

## Contributing

Repo is public for visibility. Not accepting external PRs until v0.1 ships — the interfaces are still being shaped against a private reference consumer. Watch/star to follow along.

## License

TBD (likely MIT or Apache-2.0 at v0.1).
