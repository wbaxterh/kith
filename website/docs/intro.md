---
sidebar_position: 1
slug: /
---

# What is Kith?

> *kith* (n., archaic) — one's friends, acquaintances, and kin; those who are familiar.

**Kith is a runtime-agnostic voice framework for AI companions.** It sits between your agent stack and realtime voice infrastructure, so any project can ship a companion that sounds natural without rebuilding the voice pipeline from scratch.

## The Problem

Building voice into AI companions today means choosing between two failure modes:

**Pattern A: existing voice, bad quality.** You glue TTS onto a streaming text output. The result: robotic, fragment-synthesized audio with mid-sentence prosody resets, hardcoded voice parameters, no barge-in, and no avatar integration.

**Pattern B: mature agents, no voice.** Your agent has persona, memory, RAG, and tool calling — but voice is either missing entirely or falls back to browser-native `SpeechSynthesis`. Avatar assets exist in the design folder, unwired to any pipeline.

## The Solution

Kith is the missing middle. It owns the voice loop between your agent and the transport layer — and nothing else.

```
your agent  <-->  @kithjs/core  <-->  Pipecat | LiveKit
                      |
            voice router / observability / avatar events
```

**What Kith handles:**
- Sentence-aware TTS chunking (no mid-thought pauses)
- Slang expansion, pronunciation overrides, laugh tags
- Emoji-to-emotion translation for avatar reactivity
- Barge-in detection and turn management
- Provider routing (ElevenLabs, with Cartesia + OpenAI TTS coming in v0.2)
- Normalized event bus for avatar rendering

**What Kith does NOT handle (by design):**
- Your agent logic (persona, memory, RAG, tools)
- Avatar rendering (Kith emits events; you render)
- Storage (memory adapter is pass-through)

## Packages

| Package | Purpose |
|---------|---------|
| [`@kithjs/core`](https://www.npmjs.com/package/@kithjs/core) | Adapter contracts, event bus, policy hooks |
| [`@kithjs/runtime-pipecat`](https://www.npmjs.com/package/@kithjs/runtime-pipecat) | Primary runtime — Pipecat Python sidecar |
| [`@kithjs/runtime-livekit`](https://www.npmjs.com/package/@kithjs/runtime-livekit) | LiveKit adapter (mock in v0.1, full in v0.2) |
| [`@kithjs/voice-router`](https://www.npmjs.com/package/@kithjs/voice-router) | Chunking, slang, pronunciation, emoji-to-emotion |
| [`@kithjs/observability`](https://www.npmjs.com/package/@kithjs/observability) | Traces, dup-send guards, reconnect metrics |
| [`@kithjs/avatar-events`](https://www.npmjs.com/package/@kithjs/avatar-events) | Avatar/expression event utilities (v0.2) |
