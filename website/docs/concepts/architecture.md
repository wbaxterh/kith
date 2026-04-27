---
sidebar_position: 1
---

# Architecture

Kith is structured as a monorepo of six npm packages. The design follows one principle: **Kith sits beside your agent, not inside it.**

## System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        Consumer app                          │
│   (your agent: LangGraph, custom orchestrator, anything)     │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
         text (assistant)              subscribe to events
                │                              │
                v                              │
     ┌───────────────────┐        ┌────────────v────────────┐
     │   @kithjs/core    │<───────┤  event bus (KithEvent)  │
     │   contracts only  │        └────────────^────────────┘
     └───────┬───────────┘                     │
             │                                 │
     ┌───────┴───────────────────────────────┐ │
     │                                       │ │
     v                                       v │
┌────────────────┐                ┌──────────┴─────────────┐
│ RuntimeAdapter │                │   VoiceRouter          │
│                │                │   (voice-router)       │
│  ┌──────────┐  │                │   ┌──────────────┐     │
│  │ pipecat  │──┼──> JSON-WS ───┼──>│ ElevenLabs   │     │
│  │ (python  │  │                │   │ Cartesia     │     │
│  │  sidecar)│  │                │   │ OpenAI TTS   │     │
│  └──────────┘  │                │   └──────────────┘     │
│  ┌──────────┐  │                └────────────────────────┘
│  │ livekit  │  │
│  │ (v0.2)   │  │
│  └──────────┘  │
└────────────────┘
```

## Language Boundary

This is a load-bearing decision:

- **TypeScript** — `@kithjs/core` and all consumer-facing adapters. Matches the JS ecosystems Kith is built for.
- **Python** — Pipecat sidecar (spawned as a subprocess). Communicates via JSON over WebSocket.

The extra IPC hop (~20-50ms) buys clean ergonomics for JS-stack consumers without losing Pipecat's pipeline composability.

## Adapter Contracts

| Adapter | Purpose | v0.1 |
|---------|---------|------|
| `RuntimeAdapter` | Connect, stream text/audio, barge-in, emit events | Pipecat (primary) + LiveKit (stub) |
| `VoiceAdapter` | TTS provider routing, pronunciation, chunking | ElevenLabs; Cartesia + OpenAI in v0.2 |
| `MemoryAdapter` | `fetch(turn) -> string[]` / `save(turn)` — pass-through | Interface only; consumer owns storage |
| `ExpressionAdapter` | Emits `viseme_frame`, `emotion_state`, `turn_state` | Event emission; no renderer |
| `ObservabilityAdapter` | Traces, dup-send guards, reconnect metrics | Fully implemented |

## Design Principles

1. **Stable adapter contracts are the product.** The framework's value is that consumers shouldn't care whether the runtime is Pipecat or LiveKit.

2. **Events are the contract, not methods.** Consumers subscribe to the normalized event bus. Direct method calls on adapters are an implementation detail.

3. **Kith sits beside the agent, not inside it.** We don't own memory, RAG, tool calling, or persona.

4. **Ship the procedural avatar in v0.1.** Real VRM + phoneme-to-viseme lipsync is v0.2.
