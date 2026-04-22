# Build your first companion in 15 minutes

This walks you from an empty directory to a working voice companion. You'll type something, your companion will speak it through ElevenLabs, and the avatar will react to any emojis in your text.

By the end you'll have:

- A Bun server hosting a `PipecatRuntime` (TS) + Python sidecar
- A browser client with a procedural avatar that reacts to the TTS audio
- Sentence-aware chunking, emoji → emotion, slang expansion, and laugh tags — all working

**Prerequisites**: macOS or Linux, [Bun](https://bun.sh) ≥ 1.3, Python 3.11+, [`uv`](https://docs.astral.sh/uv/) (or `pip`), an ElevenLabs API key with access to `eleven_v3`.

---

## 1. Clone the reference demo (2 min)

We'll use `apps/demo-web` as the starting point — it's the minimal consumer app.

```bash
git clone https://github.com/wbaxterh/kith.git
cd kith
bun install
```

Set up the Python sidecar's virtualenv:

```bash
cd packages/runtime-pipecat/python
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e .
cd ../../../
```

## 2. Configure your keys (1 min)

```bash
cp apps/demo-web/.env.example apps/demo-web/.env
```

Edit `apps/demo-web/.env` and fill in:

```
ELEVENLABS_API_KEY=sk_your_key
ELEVENLABS_VOICE_ID=kPzsL2i3teMYv0FxEYQ6   # or any voice from your library
```

Leave `ELEVENLABS_MODEL_ID` unset — the demo defaults to `eleven_v3`, which is what the laugh tags need.

## 3. Run it (30 sec)

```bash
cd apps/demo-web
bun run dev
```

Open <http://localhost:3030>. Type *"Hey! That's fire 🔥 haha I love it."* and click **Speak**. You should hear real laughter where "haha" was, the avatar should tint warm during the excited bits, and playback should flow across the three sentences without a mid-thought pause.

## 4. Your own consumer (5 min)

Now the interesting part — wiring Kith into something that isn't the demo.

Create `apps/my-companion/` with:

```
apps/my-companion/
├── package.json
├── public/index.html   (copy the demo's for now)
└── src/server.ts
```

`package.json`:

```json
{
  "name": "my-companion",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": { "dev": "bun --hot src/server.ts" },
  "dependencies": {
    "@kith/core": "workspace:*",
    "@kith/runtime-pipecat": "workspace:*",
    "@kith/voice-router": "workspace:*",
    "@kith/observability": "workspace:*"
  },
  "devDependencies": { "typescript": "^5.6.0" }
}
```

`src/server.ts`:

```ts
import path from "node:path";
import type { KithEvent } from "@kith/core";
import { PipecatRuntime } from "@kith/runtime-pipecat";
import { InMemoryObservability, consoleExporter } from "@kith/observability";
import {
  DEFAULT_ENGLISH_SLANG,
  DEFAULT_GENZ_SLANG,
  DEFAULT_LAUGH_TAGS,
  VoiceRouter,
} from "@kith/voice-router";

const PORT = Number(process.env.PORT ?? 3031);
const ROOT = path.dirname(Bun.fileURLToPath(import.meta.url));
const PYTHON_VENV = path.resolve(ROOT, "../../../packages/runtime-pipecat/python/.venv/bin/python");
const PYTHON_CWD = path.resolve(ROOT, "../../../packages/runtime-pipecat/python");

const obs = new InMemoryObservability();
obs.onRecord(consoleExporter); // log everything in dev

const runtime = new PipecatRuntime({
  pythonPath: PYTHON_VENV,
  cwd: PYTHON_CWD,
  observability: obs,
  config: {
    pipeline: "elevenlabs",
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    modelId: "eleven_v3",
    stability: 0.45,
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
    ...DEFAULT_LAUGH_TAGS, // requires eleven_v3
  },
});

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/speak" && req.method === "POST") {
      const { text } = (await req.json()) as { text: string };
      await voice.speak(text);
      return new Response("ok");
    }
    return new Response("send a POST to /speak with {text}");
  },
});
console.log(`listening on http://localhost:${PORT}`);
```

Run it:

```bash
cd apps/my-companion
bun run dev
curl -X POST http://localhost:3031/speak -H "Content-Type: application/json" \
  -d '{"text": "Hello from my first companion. haha this works."}'
```

You should hear the synthesized audio through the Python sidecar (which plays to the default output since we skipped the browser audio-forwarding). In a real app you'd forward the `tts_audio_chunk` events to a browser or audio device — see `apps/demo-web/src/server.ts` for that pattern.

## 5. Add a character profile (3 min)

Create `apps/my-companion/src/my-character.json`:

```json
{
  "voice": {
    "stability": 0.3,
    "style": 0.7,
    "useSpeakerBoost": true
  },
  "slang": {
    "gg": "good game"
  },
  "pronunciation": {
    "uso": "oo-so",
    "ganbare": "gahn-bah-ray"
  },
  "personaMode": "hype"
}
```

Update `server.ts`:

```ts
import myCharacter from "./my-character.json" with { type: "json" };
import { voiceCharacterToRuntimeConfig, type VoiceCharacter } from "@kith/voice-router";

const character = myCharacter as VoiceCharacter;

// Pass voice settings to the runtime:
const runtime = new PipecatRuntime({
  // …other options…
  config: {
    pipeline: "elevenlabs",
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    modelId: "eleven_v3",
    ...voiceCharacterToRuntimeConfig(character),
  },
});

// Pass the rest to the router:
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

Restart. Now slang, pronunciation overrides, and voice-side tunings are all owned by the character file.

## 6. React to emotion (3 min)

Emojis in input text auto-emit `emotion_state` events through the router. Subscribe and do something with them:

```ts
voice.on((e) => {
  if (e.type === "emotion_state") {
    console.log(`emotion: ${e.state} @ ${e.intensity}`);
    // → color a UI element, trigger an animation, whatever you want
  }
});
```

Try: `curl … -d '{"text":"yessss 🔥🔥 that was sick!!"}'` — you should see `emotion: excited @ 0.8` in the console alongside the spoken audio.

## What next

- [`docs/architecture.md`](./architecture.md) — full package map, adapter contracts, event-bus semantics
- [`docs/protocol.md`](./protocol.md) — the JSON envelope between TS and Python sidecars
- [`examples/README.md`](../examples/README.md) — composing voice profiles, layering rules
- [`docs/phase-1-planning.md`](./phase-1-planning.md) — v0.1 scope and what's deferred to v0.2 (LiveKit adapter, multi-provider fallback, VRM avatars, mic input)

If you hit something that doesn't work the way this tutorial describes, file an issue — the v0.1 API surface is supposed to be stable but a tutorial is the fastest way to find where it isn't.
