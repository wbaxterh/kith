---
sidebar_position: 3
---

# @kithjs/runtime-livekit

[![npm](https://img.shields.io/npm/v/@kithjs/runtime-livekit)](https://www.npmjs.com/package/@kithjs/runtime-livekit)

LiveKit `RuntimeAdapter` for Kith. In v0.1, this ships as a **mock-mode adapter** that proves the RuntimeAdapter contract is portable. Real LiveKit WebRTC integration is planned for v0.2.

## Install

```bash
bun add @kithjs/core @kithjs/runtime-livekit
```

## Usage (Mock Mode)

```ts
import { LiveKitRuntime } from "@kithjs/runtime-livekit";

const runtime = new LiveKitRuntime(); // mock mode by default

runtime.on((event) => {
  console.log(event.type, event);
});

await runtime.connect({ sessionId: "test" });
await runtime.sendText("Hello from LiveKit adapter");
// Emits: turn_start → tts_start → tts_audio_chunk × 3 → tts_end → turn_end
await runtime.disconnect();
```

## Why Mock Mode?

The v0.1 goal is proving **portability**: a consumer can swap `PipecatRuntime` for `LiveKitRuntime` without changing their VoiceRouter, event handling, or avatar code. The mock mode exercises the full `RuntimeAdapter` contract with deterministic timing.

## v0.2 Plans

The full LiveKit adapter will:
- Connect to LiveKit Cloud or self-hosted via WebRTC
- Forward mic audio to LiveKit rooms
- Receive TTS audio from server-side agents
- Support barge-in via LiveKit's data channels
