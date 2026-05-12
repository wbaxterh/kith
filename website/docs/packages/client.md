---
sidebar_position: 8
---

# @kithjs/client

TypeScript client for `@kithjs/server`. Connect, speak, listen to voice events.

## Install

```bash
bun add @kithjs/client
```

## Usage

```ts
import { KithClient } from "@kithjs/client";

const kith = new KithClient({
  baseUrl: "http://localhost:3040",
  characterId: "kaori",
});

await kith.connect();

kith.on((event) => {
  if (event.type === "tts_audio_chunk") {
    playAudio(event.audioB64);
  }
  if (event.type === "emotion_state") {
    updateAvatar(event.state, event.intensity);
  }
});

await kith.speak("Hey! That trick was fire haha");
await kith.disconnect();
```

## API

| Method | Description |
|--------|-------------|
| `connect()` | Create session + open WebSocket |
| `disconnect()` | Close WS + destroy session |
| `speak(text)` | Send text to be spoken |
| `bargeIn()` | Stop current TTS |
| `on(handler)` | Subscribe to KithEvents |
| `health()` | Get server health status |
| `characters()` | List available character profiles |
| `sessionId` | Current session ID (readonly) |
| `connected` | Connection status (readonly) |
