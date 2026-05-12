---
sidebar_position: 7
---

# @kithjs/server

Standalone voice microservice. POST text, get streaming audio. Framework agnostic.

## Install

```bash
bun add @kithjs/server
```

Or with Docker:

```bash
docker run -e ELEVENLABS_API_KEY=sk_... -p 3040:3040 kithjs/server
```

## Quick Start

```ts
import { KithServer } from "@kithjs/server";

const server = new KithServer({
  port: 3040,
  characterDir: "./characters",
});

await server.start();
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sessions` | POST | Create session `{ characterId? }` |
| `/sessions/:id/speak` | POST | Send text `{ text }` |
| `/sessions/:id/barge-in` | POST | Stop current TTS |
| `/sessions/:id/events` | GET | SSE event stream |
| `/sessions/:id` | DELETE | Destroy session |
| `/ws?sessionId=xxx` | WS | Full duplex WebSocket |
| `/characters` | GET | List character profiles |
| `/health` | GET | Server status |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ELEVENLABS_API_KEY` | Yes | — | ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | No | — | Default voice ID |
| `ELEVENLABS_MODEL_ID` | No | `eleven_v3` | TTS model |
| `PORT` | No | `3040` | Server port |
| `KITH_CHARACTER_DIR` | No | `./characters` | Character profiles directory |
| `KITH_DEFAULT_CHARACTER` | No | — | Default character ID |
| `KITH_PIPELINE` | No | `elevenlabs` | TTS pipeline |

## Character Profiles

Place VoiceCharacter JSON files in the characters directory:

```
characters/
  kaori.json      → characterId: "kaori"
  apollo.json     → characterId: "apollo"
```

Then create sessions with a character:

```bash
curl -X POST http://localhost:3040/sessions \
  -H "Content-Type: application/json" \
  -d '{"characterId": "kaori"}'
```
