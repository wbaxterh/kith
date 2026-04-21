# Kith — Architecture

This document describes **what ships in v0.1** and **how the pieces fit together**. It's the engineering companion to [`phase-1-planning.md`](./phase-1-planning.md), which is the scope/timeline doc. If this document and code disagree, the code is authoritative — file an issue against this doc.

---

## 1. System diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        Consumer app                          │
│   (your agent: LangGraph, custom orchestrator, anything)     │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
         text (assistant)              subscribe to events
                │                              │
                ▼                              │
     ┌───────────────────┐        ┌────────────▼────────────┐
     │   @kith/core      │◄───────┤  event bus (KithEvent)  │
     │   contracts only  │        └────────────▲────────────┘
     └───────┬───────────┘                     │
             │                                 │
     ┌───────┴───────────────────────────────┐ │
     │                                       │ │
     ▼                                       ▼ │
┌────────────────┐                ┌──────────┴─────────────┐
│ RuntimeAdapter │                │   VoiceAdapter(s)      │
│                │                │   via voice-router     │
│  ┌──────────┐  │                │   ┌──────────────┐     │
│  │ pipecat  │──┼──► JSON-WS ────┼──►│ ElevenLabs   │     │
│  │ (python  │  │                │   │ Cartesia     │     │
│  │  sidecar)│  │                │   │ OpenAI TTS   │     │
│  └──────────┘  │                │   └──────────────┘     │
│  ┌──────────┐  │                └────────────────────────┘
│  │ livekit  │  │
│  │ (stub)   │  │
│  └──────────┘  │
└────────────────┘

        │                              │
        ▼                              ▼
    user audio ──────────►  STT  ──► stt_final event
                                        │
                                        ▼
                               consumer's agent
                               (LLM + persona + tools)
                                        │
                                        ▼
                               assistant text back in
```

---

## 2. Package map

| Package                     | Role                                                 | v0.1 status  |
| --------------------------- | ---------------------------------------------------- | ------------ |
| `@kith/core`                | Adapter contracts, event types, turn types           | **shipping** |
| `@kith/runtime-pipecat`     | Primary runtime — TS facade over Python Pipecat      | Day 3-4      |
| `@kith/runtime-livekit`     | Portability stub — one integration test              | Day 10       |
| `@kith/voice-router`        | Sentence-aware chunking, provider routing, pacing    | Day 8-9      |
| `@kith/avatar-events`       | Normalized expression event stream (no renderer)     | Day 6-7      |
| `@kith/observability`       | Traces, dup-send guards, reconnect metrics           | Day 13       |

Workspace resolution via bun. Each package builds independently. Nothing depends on a runtime adapter except `apps/demo-web`.

---

## 3. Adapter contracts (v0.1)

Signatures live in `packages/core/src/adapters.ts`. Summaries here for readers who prefer prose.

### RuntimeAdapter

Owns connection lifecycle, full-duplex audio I/O, and event emission. Responsibilities:

- `connect` / `disconnect`
- `sendText(text)` — assistant text to be spoken. Chunking decisions happen here (or in a voice-router wrapped around it).
- `sendAudio(buf)` — user microphone audio.
- `bargeIn()` — cancel in-flight TTS. Idempotent.
- `on(handler)` — subscribe to normalized events.

**Non-responsibility**: memory, persona, tool calls. Those stay in the consumer's agent layer.

### VoiceAdapter

Single TTS provider. Consumers normally wrap one or more in `@kith/voice-router` for chunking / fallback / pronunciation overrides.

- `synthesize(text, options?)` — returns `ArrayBuffer` (one-shot) or `ReadableStream<Uint8Array>` (streaming). Callers decide.
- `listVoices()` — enumerate available voices.

### MemoryAdapter

**Pass-through only.** No default implementation provided. `fetch(turnId) → string[]` and `save(turn)`. Consumers own storage.

### ExpressionAdapter

Emits `viseme_frame` / `emotion_state` / `turn_start` / `turn_end`. Consumer renders. No VRM loader, no skeletal animation in v0.1.

### ObservabilityAdapter

- `trace(name, attrs?) → Span` — open/close spans.
- `guardDupSend(key) → boolean` — true if already seen in the sliding window.
- `recordReconnect(attempt)` — count + timestamp reconnect events.

---

## 4. Event bus (v0.1)

Declared in `packages/core/src/events.ts`. The event union is the **public contract** — adding a new event is cheaper than adding a method to an adapter.

| Event                  | Who emits                    | Who cares                          |
| ---------------------- | ---------------------------- | ---------------------------------- |
| `turn_start`           | RuntimeAdapter               | UI, observability                  |
| `turn_end`             | RuntimeAdapter               | UI, memory-save trigger            |
| `tts_start`            | RuntimeAdapter               | UI animation cue                   |
| `tts_end`              | RuntimeAdapter               | barge-in coordination              |
| `stt_partial`          | RuntimeAdapter               | UI live transcription              |
| `stt_final`            | RuntimeAdapter               | agent text-in                      |
| `viseme_frame`         | RuntimeAdapter (or voice)    | avatar renderer                    |
| `emotion_state`        | RuntimeAdapter (or agent)    | avatar renderer, UI                |
| `barge_in_detected`    | RuntimeAdapter               | state machine, observability       |
| `reconnect`            | RuntimeAdapter               | observability                      |
| `error`                | any adapter                  | user surface, observability        |

All events carry a `timestamp` (unix ms). Correlation is by `turnId` where applicable.

---

## 5. Language boundary

TypeScript for everything consumer-facing. Python only inside `packages/runtime-pipecat/python/` (lands Day 3-4).

Communication between the TS adapter and the Python sidecar: **JSON over WebSocket, one process per session**. Rationale:

- Keeps the npm surface clean for JS-ecosystem consumers.
- +20-50ms IPC hop is acceptable against the 200-400ms first-TTS-chunk latency we already accept by chunking on sentence boundaries.
- Sidecar lifecycle is managed by the TS adapter — not by the consumer.

Consumers never see Python types, async patterns, or process management.

---

## 6. Consumer integration shape (what "installing Kith" looks like)

```typescript
import { PipecatRuntime } from "@kith/runtime-pipecat";
import { VoiceRouter } from "@kith/voice-router";

const voice = new VoiceRouter({
  providers: [{ kind: "elevenlabs", apiKey: process.env.ELEVEN_KEY! }],
});

const runtime = new PipecatRuntime({ voice });
await runtime.connect({ sessionId: "alice-demo" });

runtime.on((e) => {
  if (e.type === "stt_final") myAgent.handleUserText(e.text);
  if (e.type === "viseme_frame") avatar.applyViseme(e.viseme, e.weight);
});

// From your agent's text-out side:
await runtime.sendText("Hey — what are you riding today?");
```

That's the whole surface area for a v0.1 consumer. Everything else (chunking, provider routing, barge-in, reconnect) happens inside Kith.

---

## 7. What's deliberately absent

Per `phase-1-planning.md` §5, v0.1 does not provide:

- An agent runtime.
- A memory / vector store.
- An avatar renderer.
- Telephony (SIP/PSTN) — v0.3+.
- Native mobile SDKs — v0.2 at earliest.
- Multi-agent orchestration — v0.3+.
- A default `MemoryAdapter` implementation (deliberate — see §3 above).

If a feature request fits into one of those categories, it's a "not yet", not a "maybe someday."

---

## 8. Open questions (tracked for iteration)

These are known-unknowns that v0.1 will inform the answers to:

- **Chunking granularity** — sentences are clearly right as the *default*, but some use cases (emotive speech, pauses) benefit from clause-level chunks. `@kith/voice-router` should expose the chunker as a strategy hook.
- **Viseme labels** — we emit a string (`"aa"`, `"ee"`, etc.). Do we converge on Oculus OVR visemes, Meta's set, or our own? Decide after the web demo sees real phoneme streams.
- **Session re-attachment** — if the Python sidecar crashes mid-conversation, does the TS adapter auto-spawn a replacement and re-emit `reconnect`? Default yes, behavior TBD past v0.1.
- **Events bus back-pressure** — what happens when a slow subscriber blocks? Default: log + drop. Revisit if it matters.
