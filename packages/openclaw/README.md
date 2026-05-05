# @kithjs/openclaw

Kith voice plugin for [OpenClaw](https://openclaw.ai) — drop-in natural TTS for your OpenClaw agents.

## Install

```bash
openclaw plugins install @kithjs/openclaw
```

Or via npm:

```bash
npm install @kithjs/openclaw
```

## Configure

In your `openclaw.yaml`:

```yaml
plugins:
  entries:
    kith-voice:
      provider: elevenlabs          # or openai_tts, cartesia, fallback
      voiceId: kPzsL2i3teMYv0FxEYQ6
      modelId: eleven_v3
      enableSlang: true
      enableEmoji: true
```

For multi-provider fallback:

```yaml
plugins:
  entries:
    kith-voice:
      provider: fallback
      fallbackProviders:
        - elevenlabs
        - openai_tts
        - cartesia
      voiceId: kPzsL2i3teMYv0FxEYQ6
```

## What It Does

When installed, Kith processes all agent voice output through its pipeline:

- **Sentence-aware chunking** — no more mid-thought pauses
- **Slang expansion** — "fr" → "for real", "lol" → real laughter
- **Pronunciation overrides** — teach the TTS to say names and terms correctly
- **Emoji → emotion** — emojis become avatar emotion events
- **Multi-provider fallback** — ElevenLabs → OpenAI → Cartesia, with circuit breaker

## Standalone Use

You can also use the processing functions directly without OpenClaw:

```ts
import { processTextForSpeech, buildPipelineConfig } from "@kithjs/openclaw";

const chunks = processTextForSpeech("Hey! That was fire 🔥 lol", {
  provider: "elevenlabs",
  enableSlang: true,
  enableEmoji: true,
});
// → ["Hey! That was fire", "[laughs]"]
```

## Documentation

- [Kith Docs](https://kith.weshuber.com)
- [Voice Characters](https://kith.weshuber.com/docs/concepts/voice-characters)
- [OpenClaw Plugin Guide](https://docs.openclaw.ai/tools/plugin)
