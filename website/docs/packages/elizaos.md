---
sidebar_position: 9
---

# @kithjs/elizaos

Drop-in voice plugin for [ElizaOS](https://elizaos.ai) agents. Replaces `@elizaos/plugin-elevenlabs` with Kith's full voice pipeline.

## Install

```bash
bun add @kithjs/elizaos
```

## Register

In your agent's character file:

```ts
import kithVoice from "@kithjs/elizaos";

export default {
  name: "MyAgent",
  plugins: [kithVoice],
  // ...
};
```

## Configure

In your `.env`:

```bash
ELEVENLABS_XI_API_KEY=sk_your_key
ELEVENLABS_VOICE_ID=kPzsL2i3teMYv0FxEYQ6
```

## What It Replaces

| Feature | plugin-elevenlabs | @kithjs/elizaos |
|---------|------------------|-----------------|
| Sentence chunking | No (raw text dump) | Yes (natural boundaries) |
| Slang expansion | No | 4 built-in dicts |
| Pronunciation | No | Per-character overrides |
| Emoji handling | Read aloud | Stripped, emotion events |
| Laugh tags | No | v3 `[laughs]` / `[giggles]` |
| Multi-provider fallback | No | ElevenLabs + OpenAI + Cartesia |
| Character profiles | No | VoiceCharacter JSON |
| Text transforms | No | Custom pipeline |

## No Python Required

Unlike the full Kith stack (which uses a Python Pipecat sidecar), the ElizaOS plugin uses `ElevenLabsDirectAdapter` — a lightweight TypeScript-native adapter that calls the ElevenLabs SDK directly. No Python, no sidecar, no extra processes.

## Standalone Use

You can use the synthesis function without ElizaOS:

```ts
import { synthesizeWithKith } from "@kithjs/elizaos";

const { audio, emotions } = await synthesizeWithKith(
  "Hey! That was fire 🔥 lol ngl",
  {
    apiKey: process.env.ELEVENLABS_XI_API_KEY,
    voiceId: "kPzsL2i3teMYv0FxEYQ6",
    modelId: "eleven_v3",
    enableSlang: true,
    enableEmoji: true,
  },
);
// audio: KithEvent[] with tts_audio_chunk events
// emotions: KithEvent[] with emotion_state events
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ELEVENLABS_XI_API_KEY` | — | ElevenLabs API key (ElizaOS convention) |
| `ELEVENLABS_VOICE_ID` | — | Voice ID |
| `ELEVENLABS_MODEL_ID` | `eleven_v3` | TTS model |
| `KITH_ENABLE_SLANG` | `true` | Enable slang expansion |
| `KITH_ENABLE_EMOJI` | `true` | Enable emoji-to-emotion |
| `KITH_CHARACTER_FILE` | — | Path to VoiceCharacter JSON |
