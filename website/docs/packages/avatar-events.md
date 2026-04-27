---
sidebar_position: 6
---

# @kithjs/avatar-events

[![npm](https://img.shields.io/npm/v/@kithjs/avatar-events)](https://www.npmjs.com/package/@kithjs/avatar-events)

Normalized avatar and expression event utilities. Currently a placeholder for v0.2 — the event types themselves live in `@kithjs/core`.

## Status

In v0.1, Kith emits avatar-relevant events (`viseme_frame`, `emotion_state`) through the core event bus. Consumers render them however they want.

v0.2 will add utilities in this package:
- VRM model helpers
- Phoneme-to-viseme mapping
- Blend shape utilities
- Expression state machine

## Using Avatar Events Today

Subscribe to events from VoiceRouter:

```ts
voice.on((event) => {
  if (event.type === "emotion_state") {
    // event.state: "excited" | "calm" | "sad" | "neutral" | ...
    // event.intensity: 0-1
    applyEmotionTint(event.state, event.intensity);
  }

  if (event.type === "viseme_frame") {
    // event.viseme: "aa" | "ee" | "oh" | "mm" | ...
    // event.weight: 0-1
    // event.offsetMs: timing offset from TTS chunk start
    updateLipSync(event.viseme, event.weight);
  }
});
```
