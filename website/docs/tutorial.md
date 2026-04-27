---
sidebar_position: 3
---

# Tutorial: Build Your First Companion

Build a working voice companion in 15 minutes. You'll type something, your companion will speak it through ElevenLabs with natural sentence pacing, and emojis will trigger emotion events.

## What You'll Build

- A Bun server hosting a `PipecatRuntime` (TS) + Python sidecar
- Sentence-aware chunking, emoji-to-emotion, slang expansion, and laugh tags
- A character profile that controls voice personality

## 1. Clone the Reference Demo

```bash
git clone https://github.com/wbaxterh/kith.git
cd kith
bun install
```

Set up the Python sidecar:

```bash
cd packages/runtime-pipecat/python
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e .
cd ../../../
```

## 2. Configure Your Keys

```bash
cp apps/demo-web/.env.example apps/demo-web/.env
```

Edit `apps/demo-web/.env`:

```
ELEVENLABS_API_KEY=sk_your_key
ELEVENLABS_VOICE_ID=kPzsL2i3teMYv0FxEYQ6
```

## 3. Run It

```bash
cd apps/demo-web
bun run dev
```

Open http://localhost:3030. Type *"Hey! That's fire haha I love it."* and click **Speak**. You should hear:
- Real laughter where "haha" was (ElevenLabs v3 laugh tags)
- Natural sentence pacing (no mid-thought pauses)
- Smooth prosody across the whole response

## 4. Create Your Own Consumer

Create a new app:

```ts
// src/server.ts
import path from "node:path";
import type { KithEvent } from "@kithjs/core";
import { PipecatRuntime } from "@kithjs/runtime-pipecat";
import { InMemoryObservability, consoleExporter } from "@kithjs/observability";
import {
  DEFAULT_ENGLISH_SLANG,
  DEFAULT_GENZ_SLANG,
  DEFAULT_LAUGH_TAGS,
  VoiceRouter,
} from "@kithjs/voice-router";

const obs = new InMemoryObservability();
obs.onRecord(consoleExporter);

const runtime = new PipecatRuntime({
  pythonPath: "./python/.venv/bin/python",
  cwd: "./python",
  observability: obs,
  config: {
    pipeline: "elevenlabs",
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    modelId: "eleven_v3",
    stability: 0.5,
    similarityBoost: 0.85,
    style: 0.4,
    useSpeakerBoost: true,
  },
});

await runtime.connect({ sessionId: "my-companion" });

const voice = new VoiceRouter({
  runtime,
  slang: {
    ...DEFAULT_ENGLISH_SLANG,
    ...DEFAULT_GENZ_SLANG,
    ...DEFAULT_LAUGH_TAGS,
  },
});

// Listen for events
voice.on((event) => {
  switch (event.type) {
    case "tts_audio_chunk":
      // Forward to browser via WebSocket
      break;
    case "emotion_state":
      console.log(`Emotion: ${event.state} @ ${event.intensity}`);
      break;
    case "turn_start":
      console.log("Speaking...");
      break;
    case "turn_end":
      console.log("Done.");
      break;
  }
});

await voice.speak("Hello from my first companion! haha this is awesome.");
```

## 5. Add a Character Profile

Create `my-character.json`:

```json
{
  "voice": {
    "stability": 0.55,
    "similarityBoost": 0.82,
    "style": 0.45,
    "useSpeakerBoost": true,
    "speed": 1.05
  },
  "slang": {
    "gg": "good game",
    "fr": "for real",
    "ngl": "not gonna lie"
  },
  "pronunciation": {
    "Kaori": "kah-oh-ree",
    "sugoi": "soo-goy"
  },
  "personaMode": "hype"
}
```

Wire it up:

```ts
import myCharacter from "./my-character.json" with { type: "json" };
import { voiceCharacterToRuntimeConfig, type VoiceCharacter } from "@kithjs/voice-router";

const character = myCharacter as VoiceCharacter;

const runtime = new PipecatRuntime({
  config: {
    pipeline: "elevenlabs",
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    modelId: "eleven_v3",
    ...voiceCharacterToRuntimeConfig(character),
  },
});

const voice = new VoiceRouter({
  runtime,
  character,
  slang: {
    ...DEFAULT_ENGLISH_SLANG,
    ...DEFAULT_GENZ_SLANG,
    ...DEFAULT_LAUGH_TAGS,
    ...character.slang,
  },
});
```

## 6. React to Emotions

Emojis in input text automatically emit `emotion_state` events:

```ts
voice.on((e) => {
  if (e.type === "emotion_state") {
    console.log(`Emotion: ${e.state} @ ${e.intensity}`);
    // Tint avatar, trigger animation, change UI color
  }
});

await voice.speak("yessss that was sick!! haha");
// → emotion: excited @ 0.8
// → [laughs] rendered as real laughter
```

## What Next

- [Architecture](/docs/concepts/architecture) — Full system diagram and adapter contracts
- [Voice Characters](/docs/concepts/voice-characters) — Deep dive into character profiles
- [Kaori Case Study](/docs/guides/kaori-case-study) — How we integrated Kith into a production companion
- [Roadmap](/docs/roadmap) — What's coming in v0.2 and beyond
