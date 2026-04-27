---
sidebar_position: 2
---

# Event Bus

The normalized event bus is Kith's primary contract. Adapters emit these events; consumers subscribe to them. Everything else is an implementation detail.

## Event Types

| Event | When | Key Fields |
|-------|------|------------|
| `turn_start` | A new conversational turn begins | `turnId`, `role` ("user" or "assistant") |
| `turn_end` | A turn completes | `turnId`, `role` |
| `tts_start` | TTS synthesis begins for a chunk | `turnId`, `chunkId` |
| `tts_audio_chunk` | A slice of synthesized audio | `turnId`, `chunkId`, `audioB64`, `mimeType` |
| `tts_end` | TTS synthesis completes for a chunk | `turnId`, `chunkId` |
| `stt_partial` | Partial speech-to-text transcription | `turnId`, `text` |
| `stt_final` | Final speech-to-text transcription | `turnId`, `text` |
| `viseme_frame` | A single viseme for lip sync | `turnId`, `viseme`, `weight`, `offsetMs` |
| `emotion_state` | Emotional state hint for avatar | `state`, `intensity` |
| `barge_in_detected` | User interrupted the assistant | `turnId` |
| `reconnect` | Runtime reconnected after disconnect | `attempt` |
| `error` | Something went wrong | `message`, `retriable` |

## Subscribing

```ts
const unsub = voice.on((event) => {
  switch (event.type) {
    case "tts_audio_chunk":
      // Play audio
      break;
    case "emotion_state":
      // Tint avatar
      break;
    case "barge_in_detected":
      // Stop playback
      break;
  }
});

// Later: unsub();
```

## Event Flow

A typical `voice.speak("Hello! haha")` produces this sequence:

```
emotion_state { state: "neutral", intensity: 0.5 }
turn_start    { turnId: "t1", role: "assistant" }
tts_start     { turnId: "t1", chunkId: "c1" }
tts_audio_chunk × N
tts_end       { turnId: "t1", chunkId: "c1" }
turn_end      { turnId: "t1", role: "assistant" }
```

All events include a `timestamp` field (Unix ms).

## Router vs Runtime Events

- **Runtime events** come from the sidecar: `turn_start`, `turn_end`, `tts_*`, `stt_*`, `viseme_frame`, `barge_in_detected`, `reconnect`, `error`.
- **Router-synthesized events** come from VoiceRouter: `emotion_state` (parsed from emojis in the input text).

Subscribe via `voice.on()` (not `runtime.on()`) to get both.
