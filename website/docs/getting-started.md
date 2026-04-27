---
sidebar_position: 2
---

# Getting Started

Get Kith running in under 5 minutes.

## Prerequisites

- [Bun](https://bun.sh) >= 1.3 (also works with Node.js 18+)
- Python 3.11+ with [`uv`](https://docs.astral.sh/uv/) (for the Pipecat sidecar)
- An [ElevenLabs](https://elevenlabs.io) API key

## Install

```bash
bun add @kithjs/core @kithjs/runtime-pipecat @kithjs/voice-router
```

Or with npm:

```bash
npm install @kithjs/core @kithjs/runtime-pipecat @kithjs/voice-router
```

Optional packages:

```bash
bun add @kithjs/observability    # traces + dup-send guards
bun add @kithjs/runtime-livekit  # LiveKit adapter (mock mode in v0.1)
```

## Set Up the Python Sidecar

The Pipecat runtime needs a Python virtualenv with the sidecar installed:

```bash
cd node_modules/@kithjs/runtime-pipecat/python
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e .
```

## Minimal Example

```ts
import { PipecatRuntime } from "@kithjs/runtime-pipecat";
import { VoiceRouter, DEFAULT_ENGLISH_SLANG } from "@kithjs/voice-router";

const runtime = new PipecatRuntime({
  pythonPath: "node_modules/@kithjs/runtime-pipecat/python/.venv/bin/python",
  cwd: "node_modules/@kithjs/runtime-pipecat/python",
  config: {
    pipeline: "elevenlabs",
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    modelId: "eleven_v3",
  },
});

await runtime.connect({ sessionId: "hello-kith" });

const voice = new VoiceRouter({
  runtime,
  slang: DEFAULT_ENGLISH_SLANG,
});

voice.on((event) => {
  if (event.type === "tts_audio_chunk") {
    console.log("Got audio chunk:", event.audioB64.length, "bytes");
  }
});

await voice.speak("Hello from Kith! This is sentence-aware TTS.");
await runtime.disconnect();
```

## Next Steps

- **[Tutorial](/docs/tutorial)** — Build a full companion with character profiles, emoji reactions, and laugh tags in 15 minutes
- **[Architecture](/docs/concepts/architecture)** — Understand how the pieces fit together
- **[Voice Characters](/docs/concepts/voice-characters)** — Define your companion's voice personality
