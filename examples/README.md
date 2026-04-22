# Kith examples

Drop-in configs and samples for the things Kith leaves to consumers.

## `voice-profile.json`

A typed bundle of a single character's voice-layer settings. Kith ships the `VoiceCharacter` type; the file itself is yours to name, author, and version-control however you want.

```ts
import profile from "./voice-profile.json" with { type: "json" };
import { PipecatRuntime } from "@kith/runtime-pipecat";
import {
  DEFAULT_ENGLISH_SLANG,
  DEFAULT_GENZ_SLANG,
  DEFAULT_BOARD_SPORTS_SLANG,
  DEFAULT_LAUGH_TAGS,
  VoiceRouter,
  voiceCharacterToRuntimeConfig,
  type VoiceCharacter,
} from "@kith/voice-router";

const character = profile as VoiceCharacter;

const runtime = new PipecatRuntime({
  pythonPath: "…",
  cwd: "…",
  config: {
    pipeline: "elevenlabs",
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    ...voiceCharacterToRuntimeConfig(character),
  },
});

const voice = new VoiceRouter({
  runtime,
  character,
  // Compose the defaults under your character's overrides. Character slang
  // wins on collision (spread order).
  slang: {
    ...DEFAULT_ENGLISH_SLANG,
    ...DEFAULT_GENZ_SLANG,
    ...DEFAULT_BOARD_SPORTS_SLANG,
    ...DEFAULT_LAUGH_TAGS, // requires ELEVENLABS_MODEL_ID=eleven_v3
    ...character.slang,
  },
});
```

### What goes in a profile

Only voice-layer knobs. Kith stays out of your agent's brain.

| Field            | Purpose                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `voice`          | TTS settings — voiceId, model, stability/similarity/style/speaker_boost    |
| `slang`          | Abbreviation / expansion map (`"omg": "oh my god"`, `"fs": "frontside"`)   |
| `pronunciation`  | Name + loanword pronunciation (`"ganbare": "gahn-bah-ray"`)                |
| `emojiMap`       | Custom emoji → emotion overrides (use `null` to disable parsing entirely)  |
| `personaMode`    | Hint (`neutral` \| `hype` \| `coach` \| `calm`) — consumers decide its use |

What's intentionally NOT in a voice profile:

- Bio / lore / system prompt (your agent's job)
- Tool definitions, memory config, RAG indices
- Conversation history
- Anything agent-runtime-shaped

### Layering rules

```
framework defaults < voice profile < explicit VoiceRouter options
```

- The character is a convenience. Any field you *also* pass explicitly to `VoiceRouter` wins over the character version.
- Slang composition is not automatic — you spread the dicts yourself so it's visible what's being mixed.
- Voice-side settings (`voice.*`) are NOT applied by the VoiceRouter. You extract them with `voiceCharacterToRuntimeConfig` and pass them into your runtime's pipeline config.

### Mid-session swaps

If the character changes while a session is live, use `applyVoiceCharacter(router, newCharacter)` — it updates slang, pronunciation, and persona mode on the existing router without a reconnect. Voice-side settings (model, voiceId) can't be swapped hot — those live in the Python runtime and require tearing down the connection.

## `companion-slang-skate.json`

Example extra slang for a skate/snow/surf-focused voice companion. Reference only — no special format. Spread into your slang dict alongside the defaults.
