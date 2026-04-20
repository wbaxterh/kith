# Kith — Agent Conventions

## What this is

Kith is a **runtime-agnostic voice framework for AI companions**. It sits between an agent stack (LangGraph, custom orchestrators, or anything a consumer has built) and realtime voice infrastructure (Pipecat, LiveKit). See `README.md` for the public pitch.

**Source of truth for scope**: [`docs/phase-1-planning.md`](docs/phase-1-planning.md). If you're about to propose a change that conflicts with that document, stop and either (a) argue the doc should change first, or (b) narrow your change to fit. Do not silently drift.

## Status

Pre-alpha. v0.1 is a 2-week build. See the timeline in the planning doc. **No production users yet.** That means: low migration risk, high ergonomics leverage — get the public API right now while nobody depends on it.

## Architecture principles

1. **Stable adapter contracts are the product.** The framework's value is that `@kith/core` users shouldn't have to care whether the runtime is Pipecat or LiveKit. Changing an adapter interface in v0.1 is cheap; changing it post-v0.1 is expensive. Design like someone else will implement an adapter against it.

2. **Kith sits *beside* the agent, not *inside* it.** We don't own memory, RAG, tool calling, or persona — those stay in the consumer app. `MemoryAdapter` is pass-through. If you find yourself designing a vector store, you're in the wrong repo.

3. **Events are the contract, not methods.** Consumers subscribe to the normalized event bus (`turn_start`, `tts_start`, `viseme_frame`, etc.). Direct method calls on adapters are an implementation detail. Prefer adding events over adding method signatures.

4. **Language boundary is deliberate.** TypeScript facade (`@kith/core`, all adapters) + Python sidecar for Pipecat. Don't leak Python types or async patterns into the TS surface. If you're tempted to `pythonProcess.stdin.write(...)` from `@kith/core`, that's a smell — it belongs inside `runtime-pipecat`.

5. **Ship the procedural avatar in v0.1.** Real VRM + phoneme-to-viseme lipsync is v0.2. If you add three-vrm to a v0.1 package.json, push back before writing the import.

## Repo layout (when packages land)

```
packages/
├── core/                 @kith/core — contracts, event bus, policy engine
├── runtime-pipecat/      TS adapter + Python sidecar in ./python/
├── runtime-livekit/      v0.1 stub; one integration test only
├── voice-router/         @kith/voice-router
├── avatar-events/        @kith/avatar-events
└── observability/        @kith/observability
apps/
└── demo-web/             reference consumer; not published
docs/
├── phase-1-planning.md   source of truth for v0.1 scope
└── architecture.md       (to write on Day 1)
```

Monorepo via bun workspaces. Python sidecars live inside their TS packages (`packages/runtime-pipecat/python/`), not at repo root — keeps the "install one thing to try" story simple.

## Toolchain (planned)

- **TS/JS**: bun (install, test, scripts). Not npm or pnpm. Fast install and test loop, matches the ecosystems Kith is built to slot into.
- **Python**: uv (or poetry if uv is painful on macOS). Locked to 3.11 minimum for Pipecat compat.
- **Lint/format**: biome (not prettier + eslint). One tool, one config.
- **Tests**: vitest for TS; pytest for Python. No bun:test until it's clearly stable across the monorepo.

Don't add tooling without an owner committing to maintain its config. We've seen too many dead `.eslintrc` files.

## Subagent usage

- **Explore** for searching across packages once there's more than one. Quicker than manual globbing when looking for a cross-package concept (e.g., "where do we emit `viseme_frame`?").
- **Plan** for architecture decisions that touch ≥2 packages or cross the TS/Python boundary. A Plan pass is cheap insurance against adapter-contract regret.
- Don't delegate *understanding* to subagents. If you ask an agent to "implement the Pipecat barge-in handler," you still need to know what barge-in is and what the event contract looks like — otherwise you can't judge the output.

## Commit + PR hygiene

- One adapter interface change per PR. Don't bundle a `voice-router` chunking rewrite with a `core` event rename.
- PR descriptions reference sections of `docs/phase-1-planning.md` when the change relates to locked scope. If your PR doesn't, and it affects shape/scope, update the planning doc's §8 decision log in the same PR.
- No commits to `main` that break the demo app. If the Pipecat sidecar stops speaking, the demo should either run with the LiveKit stub or fail with a clear error — never silently produce garbage audio.

## Non-goals (keep saying no)

- Replacing agent runtimes.
- Reimplementing memory / RAG / vector stores.
- Owning the avatar renderer beyond event emission.
- Telephony (v0.3+).
- Native mobile (v0.2 at earliest, via LiveKit adapter).

## Before you touch code

1. Read `docs/phase-1-planning.md` §2 (architecture) and §5 (non-goals).
2. Confirm which of the six v0.1 packages you're in. If none fit, the change probably doesn't belong in Kith yet.
3. If you're introducing a new event type, add it to the event-bus enum in `@kith/core` *first* — not in the adapter emitting it.
