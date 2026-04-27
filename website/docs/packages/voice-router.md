---
sidebar_position: 4
---

# @kithjs/voice-router

[![npm](https://img.shields.io/npm/v/@kithjs/voice-router)](https://www.npmjs.com/package/@kithjs/voice-router)

The voice quality layer. Sentence-aware chunking, slang expansion, pronunciation overrides, emoji-to-emotion translation, VoiceCharacter profiles, and a text transform pipeline.

## Install

```bash
bun add @kithjs/core @kithjs/voice-router
```

## Core Class: VoiceRouter

```ts
import { VoiceRouter, DEFAULT_ENGLISH_SLANG, DEFAULT_LAUGH_TAGS } from "@kithjs/voice-router";

const voice = new VoiceRouter({
  runtime,          // any RuntimeAdapter
  slang: { ...DEFAULT_ENGLISH_SLANG, ...DEFAULT_LAUGH_TAGS },
  pronunciation: { "Kaori": "kah-oh-ree" },
  transforms: [myCustomTransform],
  personaMode: "hype",
});

await voice.speak("Hey! That was fire haha omg");
```

## What VoiceRouter Does

1. **Strips emojis** and emits `emotion_state` events based on emoji sentiment
2. **Chunks text at sentence boundaries** (no mid-thought prosody resets)
3. **Expands slang** ("fr" -> "for real", "lol" -> "[laughs]")
4. **Applies pronunciation overrides** ("Kaori" -> "kah-oh-ree")
5. **Runs custom text transforms** (your cleanup/formatting logic)
6. **Deduplicates** identical sentences within a configurable window

## Default Slang Dicts

| Dict | Contents | Example |
|------|----------|---------|
| `DEFAULT_ENGLISH_SLANG` | Universal text-speak | btw -> by the way, omg -> oh my god |
| `DEFAULT_GENZ_SLANG` | Gen Z shorthand | fr -> for real, ngl -> not gonna lie |
| `DEFAULT_BOARD_SPORTS_SLANG` | Skate/snow/surf terms | fs -> frontside, kf -> kickflip |
| `DEFAULT_LAUGH_TAGS` | Laugh text to v3 audio tags | haha -> [laughs], hehe -> [giggles] |

## VoiceCharacter Profiles

Bundle voice settings + slang + pronunciation into a JSON file. See [Voice Characters](/docs/concepts/voice-characters).

## Text Transforms

Add custom preprocessing before TTS:

```ts
const cleanMarkdown = (text: string) => {
  return text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
};

const voice = new VoiceRouter({
  runtime,
  transforms: [cleanMarkdown],
});
```
