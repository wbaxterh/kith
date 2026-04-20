# Kith — Phase 1 Planning

**Status**: v0.1 pre-build · locked after stress-test on 2026-04-20.

This document is the source of truth for v0.1 scope. If code and this document disagree, one of them is wrong and we decide explicitly which before merging.

---

## 1. Why Kith exists

Two patterns repeat across production companion voice stacks:

### Pattern A: existing voice, bad quality

Stacks that glue TTS onto a streaming text output exhibit:

- Length-based chunking (e.g., flushing at 24 / 88 characters) that ignores sentence boundaries → provider synthesizes fragments in isolation → robotic cadence and mid-sentence prosody resets.
- Voice-style parameters hardcoded in the request path; richer controls (`style`, `use_speaker_boost`, `seed`) never plumbed through.
- Default models pinned to latency-optimized variants at the cost of naturalness.
- No SSML or prosody pre-processing.
- No barge-in, no turn detection, no avatar/expression layer.

### Pattern B: mature agents, no voice

Stacks with capable agent runtimes (persona, memory, RAG, tool calling) often lack a viable voice path entirely — or have partial stubs that fall back to browser-native `SpeechSynthesis`. Avatars exist as assets (e.g., a VRM file in the design folder) but are unwired to any lipsync/viseme pipeline.

### Takeaway

The two failure modes are complementary. Pattern A proves "glue TTS on a streaming text output" doesn't work. Pattern B proves *non-voice* companion primitives (persona, memory, tools, RAG) belong *outside* a voice framework. Kith is the missing middle — it owns the voice loop between agent and transport, and nothing else.

---

## 2. Architecture

### Language boundary (load-bearing decision)

TS facade + Python runtime sidecar.

- `@kith/core` and all consumer-facing adapters are **TypeScript** (bun/node). This matches the ecosystems of the companion stacks Kith is built to slot into and the likely web/RN consumers.
- `@kith/runtime-pipecat` spawns Pipecat as a **Python sidecar process**, speaks JSON over WebSocket. Extra IPC hop (~20-50ms) in exchange for keeping the public API ergonomic for JS-stack users.
- Rationale vs. alternatives:
  - Python framework + TS client: adoption friction for JS-ecosystem contributors.
  - TS + LiveKit primary: loses the pipeline composability we picked Pipecat for.
  - Dual-runtime from day 1: too much scope for v0.1.

### Adapters

| Adapter | Purpose | v0.1 scope |
|---|---|---|
| `RuntimeAdapter` | Connect/stream-in/stream-out, barge-in, emit normalized events | Pipecat (primary) + LiveKit (stub) |
| `VoiceAdapter` | TTS provider routing, pronunciation overrides, sentence-aware chunking, pacing | ElevenLabs + Cartesia; OpenAI TTS as fallback |
| `MemoryAdapter` | `fetch(turn) → string[]` / `save(turn)` — pass-through only | Pass-through interface; consumer owns storage |
| `ExpressionAdapter` | Emits `viseme_frame` / `emotion_state` / `turn_state`. Consumer renders. | Event emission; no renderer |
| `ObservabilityAdapter` | Traces, dup-send guards, reconnect metrics | In scope for v0.1 (upgraded from "later") |

### Normalized event bus

Events adapters emit (stable contract for consumers):

```
turn_start, turn_end
tts_start, tts_end
stt_partial, stt_final
viseme_frame, emotion_state
barge_in_detected
error, reconnect
```

### v0.1 packages

- `@kith/core`
- `@kith/runtime-pipecat`
- `@kith/runtime-livekit` (beta stub)
- `@kith/voice-router`
- `@kith/avatar-events`
- `@kith/observability`
- `apps/demo-web` (reference consumer, not published)

---

## 3. Decisions locked for v0.1

| Decision | Choice | Note |
|---|---|---|
| Primary runtime | Pipecat | LiveKit adapter lands in v0.1 as portability proof, not production path |
| Language boundary | TS facade + Python Pipecat sidecar | Docker-wrapped for dev ergonomics |
| Avatar in v0.1 | Procedural head (amplitude-driven mouth, state-colored tints) | Real VRM + phoneme-to-viseme lipsync → v0.2 |
| Observability | Yes, v0.1 | Traces + dup-send guards + reconnect metrics |
| Reference consumer | Private (greenfield companion) | Validates against a real companion stack without conflicting with in-flight voice work elsewhere |
| Repo structure | Monorepo | `packages/*` for `@kith/*`, `apps/*` for demo |
| Telephony | v0.3+ | Explicitly called out in README to set expectations |
| Mobile (RN) | v0.2 | LiveKit RN SDK has a path; Pipecat-via-Docker does not reach RN natively |

---

## 4. Two-week build plan (stress-tested)

Ratings: ✅ realistic · ⚠️ tight · 🔴 optimistic

### Week 1 — core + demo

| Day | Task | Rating | Protect / cut |
|---|---|---|---|
| 1-2 | Core interfaces (5 adapters, signatures + happy-path types) | ✅ | Don't design full event taxonomy in 2 days — iterate post-demo |
| 3-4 | Pipecat adapter v1: realtime loop, barge-in, VAD endpointing, normalized events | ⚠️ | Buffer zero. Language-boundary decision must already be made (it is). |
| 5 | Companion policy engine: persona modes, text normalization dictionary, response-style hooks | ✅ | Scope to "pluggable pre-LLM transform." Full policy DSL = own project. |
| 6-7 | Web demo: procedural avatar + smooth mouth/emote stream + one-click run (Docker + `.env.example`) | ✅ | **VRM cut to v0.2** — this day uses a procedural head (amplitude-driven mouth scale, state-colored tints). Without that cut, this was 🔴. |

### Week 2 — quality + portability + ship

| Day | Task | Rating | Protect / cut |
|---|---|---|---|
| 8-9 | Voice quality layer: provider router (ElevenLabs + Cartesia + OpenAI TTS), pronunciation overrides, **sentence-aware chunking**, pacing, fallback/dedupe | ✅ | Highest-leverage work. Directly fixes the Pattern A failure modes from §1. |
| 10 | LiveKit adapter stub: one integration test passes (send text → get audio → emit at least one normalized event) | ⚠️ | "Enough to validate portability" = **one** integration test. Anything more = scope creep. |
| 11-12 | DevEx + docs: README, architecture diagram, "Build your first companion in 15 min" tutorial, adapter API docs | ⚠️ | Protect this day. First impression matters more than a polished LiveKit stub. |
| 13 | Reliability pass: dup-send guard, barge-in behavior, delayed TTS URL/stream events, reconnect | ⚠️ | Don't oversell — ship as "beta, tested on happy-paths + these N edge cases." |
| 14 | v0.1 release: GitHub release + examples + short launch post + roadmap | ✅ | Assumes upstream held. |

---

## 5. Explicit non-goals (v0.1)

- Replacing agent runtimes (LangGraph, custom orchestrators, or anything you've built). Kith sits beside, not inside.
- Reimplementing memory / RAG / vector stores. `MemoryAdapter` is pass-through.
- Owning the avatar renderer. We emit events; consumers render.
- Telephony (SIP/PSTN). Deferred to v0.3+.
- Native mobile (React Native, Swift, Kotlin). Deferred to v0.2.
- Multi-agent orchestration. Deferred to v0.3+.

---

## 6. Risks + open questions

- **Pipecat maturity on macOS for local dev.** Docker wrapping mitigates, but first-run developer experience needs testing on fresh machines before v0.1 ships.
- **npm scope `@kith`** — verified free on 2026-04-20. Need to create the npm org under wbaxterh before first publish.
- **Reference-consumer dogfood loop** — the reference consumer's backend needs to emit agent output in a form Kith can consume. Likely: a small adapter inside the consumer that forwards tool-call-completed text into Kith's text-in channel. Estimate this before Day 1 of Week 2.
- **LiveKit adapter test** — LiveKit's cloud tier or local dev server? Picking local-dev-server keeps v0.1 self-contained.

---

## 7. What's in each package (bootstrap tree)

```
kith/
├── packages/
│   ├── core/                    # @kith/core — contracts, event bus, policy engine
│   ├── runtime-pipecat/         # TS adapter + Python sidecar in subfolder
│   ├── runtime-livekit/         # stub for v0.1
│   ├── voice-router/            # @kith/voice-router
│   ├── avatar-events/           # @kith/avatar-events
│   └── observability/           # @kith/observability
├── apps/
│   └── demo-web/                # reference consumer
├── docs/
│   ├── phase-1-planning.md      # this file
│   └── architecture.md          # to write on Day 1
├── README.md
├── CLAUDE.md                    # agentic dev guidance
└── package.json                 # root workspace config (bun workspaces)
```

---

## 8. Decision log (updates go below, newest first)

- **2026-04-20** — Plan locked. Name: Kith. Repo: `wbaxterh/kith`. Primary runtime: Pipecat. Reference consumer selected (private). All §3 decisions finalized.
