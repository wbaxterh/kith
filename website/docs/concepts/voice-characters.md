---
sidebar_position: 3
---

# Voice Characters

A `VoiceCharacter` profile bundles all voice-layer settings for a companion into a single JSON file. It controls how the companion **sounds** — not what it says (that's your agent's job).

## Character Profile Shape

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
    "fr": "for real",
    "ngl": "not gonna lie",
    "gg": "good game"
  },
  "pronunciation": {
    "Kaori": "kah-oh-ree",
    "sugoi": "soo-goy",
    "ganbare": "gahn-bah-ray"
  },
  "personaMode": "hype"
}
```

## Voice Settings

These control the ElevenLabs TTS parameters:

| Setting | Range | Effect |
|---------|-------|--------|
| `stability` | 0-1 | Higher = more consistent, lower = more expressive |
| `similarityBoost` | 0-1 | How closely to match the original voice |
| `style` | 0-1 | Style exaggeration (0 = neutral, 1 = maximum) |
| `useSpeakerBoost` | bool | Enhances voice clarity |
| `speed` | 0.5-2.0 | Playback speed (1.0 = normal) |

**Tuning tips:**
- For smooth, natural speech: `stability: 0.5-0.6`, `style: 0.3-0.5`
- For expressive, animated speech: `stability: 0.25-0.4`, `style: 0.6-0.8`
- For fast-paced hype character: add `speed: 1.05-1.1`

## Slang Expansion

The slang dict maps abbreviations to their spoken form. TTS engines read "fr" as "eff are" — slang expansion fixes this.

Kith ships four default dicts you can compose:

```ts
import {
  DEFAULT_ENGLISH_SLANG,    // btw, fyi, omg, lol, etc.
  DEFAULT_GENZ_SLANG,       // fr, ngl, sus, bet, etc.
  DEFAULT_BOARD_SPORTS_SLANG, // fs, bs, kf, hf, etc.
  DEFAULT_LAUGH_TAGS,       // haha → [laughs], hehe → [giggles]
} from "@kithjs/voice-router";

const slang = {
  ...DEFAULT_ENGLISH_SLANG,
  ...DEFAULT_GENZ_SLANG,
  ...DEFAULT_LAUGH_TAGS,
  ...character.slang, // character's custom overrides win
};
```

:::tip Laugh Tags
`DEFAULT_LAUGH_TAGS` converts "haha", "lol", "hehe" into ElevenLabs v3 audio tags (`[laughs]`, `[giggles]`) that render as **real laughter**. This only works with `eleven_v3` — on older models the tags are read aloud literally.
:::

## Pronunciation Overrides

For names, loanwords, or anything the TTS mispronounces:

```json
{
  "pronunciation": {
    "Kaori": "kah-oh-ree",
    "Hokkaido": "hoh-kai-doh",
    "SSX": "S S X"
  }
}
```

## Wiring It Up

```ts
import profile from "./my-character.json" with { type: "json" };
import { voiceCharacterToRuntimeConfig, type VoiceCharacter } from "@kithjs/voice-router";

const character = profile as VoiceCharacter;

// Voice settings go to the runtime
const runtime = new PipecatRuntime({
  config: {
    pipeline: "elevenlabs",
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    ...voiceCharacterToRuntimeConfig(character),
  },
});

// Everything else goes to the router
const voice = new VoiceRouter({
  runtime,
  character,
  slang: { ...DEFAULT_ENGLISH_SLANG, ...character.slang },
});
```
