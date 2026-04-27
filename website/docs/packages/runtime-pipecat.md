---
sidebar_position: 2
---

# @kithjs/runtime-pipecat

[![npm](https://img.shields.io/npm/v/@kithjs/runtime-pipecat)](https://www.npmjs.com/package/@kithjs/runtime-pipecat)

The primary `RuntimeAdapter` implementation. Spawns [Pipecat](https://github.com/pipecat-ai/pipecat) as a Python sidecar process and communicates via JSON over WebSocket.

## Install

```bash
bun add @kithjs/core @kithjs/runtime-pipecat
```

Python sidecar setup:

```bash
cd node_modules/@kithjs/runtime-pipecat/python
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e .
```

## Usage

```ts
import { PipecatRuntime } from "@kithjs/runtime-pipecat";

const runtime = new PipecatRuntime({
  pythonPath: ".venv/bin/python",
  cwd: "./python",
  config: {
    pipeline: "elevenlabs",
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: "kPzsL2i3teMYv0FxEYQ6",
    modelId: "eleven_v3",
    stability: 0.5,
    similarityBoost: 0.85,
  },
  maxReconnectAttempts: 5, // auto-respawn on sidecar crash
});

await runtime.connect({ sessionId: "my-session" });
await runtime.sendText("Hello world");
await runtime.bargeIn(); // stop any in-flight TTS
await runtime.disconnect();
```

## Features

- **Auto-respawn** — if the Python sidecar exits unexpectedly, PipecatRuntime automatically respawns with bounded exponential backoff (configurable max attempts)
- **Full event emission** — all 12 KithEvent types flow through
- **Barge-in** — instantly stops in-flight TTS
- **Observability integration** — pass an `ObservabilityAdapter` to track reconnects

## Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pythonPath` | string | required | Path to Python binary in virtualenv |
| `cwd` | string | required | Working directory for the Python sidecar |
| `config` | object | `{}` | Pipeline config (provider, API keys, voice settings) |
| `observability` | ObservabilityAdapter | none | Optional observability integration |
| `maxReconnectAttempts` | number | 5 | Max auto-respawn attempts (0 to disable) |
