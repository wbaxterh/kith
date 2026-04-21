# Kith Runtime Protocol (v0)

Wire contract between a Kith TypeScript **runtime adapter** and its **Python sidecar**. Applies to `@kith/runtime-pipecat` today; the shape is intended to generalize to any language-boundary adapter.

- **Transport**: WebSocket (localhost, adapter-chosen port).
- **Encoding**: JSON, one message per frame.
- **Field case**: `camelCase` everywhere (matches the TypeScript `KithEvent` surface exactly — no transformer needed on the consumer side).
- **Schema version**: `"v": 0` on every message. Bumped on breaking changes.

---

## Startup handshake

1. The TS adapter spawns the Python sidecar as a subprocess.
2. The sidecar binds a WebSocket server on `127.0.0.1:0` (OS-assigned free port) and prints a single line to `stdout`:

   ```
   KITH_RUNTIME_READY port=54321
   ```

   No other stdout before this line. Any bytes after are informational logs the TS adapter may forward to `@kith/observability`.
3. The TS adapter parses the port, opens a WebSocket to `ws://127.0.0.1:<port>/`, and sends a `hello` op.
4. The sidecar replies with `ready`. From that point the connection is a bidirectional message stream until either side sends `disconnect`.

---

## TS → Python (ops)

All op envelopes share:

```json
{ "v": 0, "op": "<name>", "id": "<optional correlation id>" }
```

### `hello`

Sent once, immediately after WebSocket connect.

```json
{ "v": 0, "op": "hello", "sessionId": "alice-demo", "config": { } }
```

`config` is opaque to `@kith/core`; each runtime defines its own shape (e.g., TTS provider, voice IDs, VAD thresholds). The sidecar replies with a `ready` event.

### `sendText`

Assistant text to speak.

```json
{ "v": 0, "op": "sendText", "turnId": "t-42", "text": "Hey — what are you riding today?" }
```

If `turnId` is omitted, the sidecar invents one.

### `sendAudio`

One chunk of user microphone audio.

```json
{ "v": 0, "op": "sendAudio", "audioB64": "<base64>", "sampleRate": 16000, "mimeType": "audio/l16" }
```

`sampleRate` is required. `mimeType` defaults to `audio/l16` when omitted. Audio frames are NOT acked individually — backpressure is handled by the WebSocket layer.

### `bargeIn`

Cancel any in-flight TTS immediately. Idempotent.

```json
{ "v": 0, "op": "bargeIn" }
```

### `disconnect`

Graceful shutdown. Sidecar finishes flushing events, closes the WebSocket, exits with code 0.

```json
{ "v": 0, "op": "disconnect" }
```

---

## Python → TS (events)

All event envelopes share:

```json
{ "v": 0, "event": "<name>", "timestamp": 1714060800000 }
```

`timestamp` is Unix milliseconds. Every event the sidecar emits maps 1:1 to a `KithEvent` variant in `@kith/core/events.ts` — the TS adapter just strips `v` and forwards.

### `ready`

One-time, after `hello`. Tells the TS adapter the pipeline is warm and ops can flow.

```json
{ "v": 0, "event": "ready", "timestamp": 1714060800000 }
```

### Turn lifecycle

```json
{ "v": 0, "event": "turn_start", "timestamp": …, "turnId": "t-42", "role": "assistant" }
{ "v": 0, "event": "turn_end",   "timestamp": …, "turnId": "t-42", "role": "assistant" }
```

### TTS lifecycle

```json
{ "v": 0, "event": "tts_start", "timestamp": …, "turnId": "t-42", "chunkId": "c-0" }
{ "v": 0, "event": "tts_end",   "timestamp": …, "turnId": "t-42", "chunkId": "c-0" }
```

One `tts_start`/`tts_end` pair per synthesis chunk. Multiple pairs per turn when the pipeline chunks a long response at sentence boundaries.

### STT

```json
{ "v": 0, "event": "stt_partial", "timestamp": …, "turnId": "t-42", "text": "hey what are" }
{ "v": 0, "event": "stt_final",   "timestamp": …, "turnId": "t-42", "text": "hey what are you riding" }
```

`stt_partial` is emitted best-effort — consumers should tolerate none, one, or many between final events.

### Avatar / expression

```json
{ "v": 0, "event": "viseme_frame",  "timestamp": …, "turnId": "t-42", "viseme": "aa", "weight": 0.8, "offsetMs": 120 }
{ "v": 0, "event": "emotion_state", "timestamp": …, "state": "excited", "intensity": 0.6 }
```

### Operational

```json
{ "v": 0, "event": "barge_in_detected", "timestamp": …, "turnId": "t-42" }
{ "v": 0, "event": "reconnect",         "timestamp": …, "attempt": 2 }
{ "v": 0, "event": "error",             "timestamp": …, "message": "…", "retriable": true }
```

---

## Backpressure and ordering

- The sidecar guarantees events for a given `turnId` arrive in causal order (`turn_start` before `tts_start`, `tts_end` before `turn_end`, etc.).
- Across turns there is no ordering guarantee — consumers should key on `turnId`.
- Audio frames may be dropped by the sidecar under load. Text ops (`sendText`, `bargeIn`) are never dropped silently — the sidecar emits an `error` event if it can't enqueue.

## Lifecycle and failure

- If the sidecar process exits unexpectedly, the TS adapter emits `error` with `retriable: true` and `reconnect` with the next attempt number, then respawns (bounded exponential backoff).
- If the TS adapter sends an op while the WebSocket is closed, it buffers the op (bounded) until reconnected or raises after the bound is exceeded.
- The sidecar SHOULD handle SIGTERM gracefully (close WS, flush events, exit 0). Hard kills (SIGKILL) are the TS adapter's last-resort shutdown path.

---

## Versioning

- `"v": 0` is the current schema. Field additions are non-breaking when consumers use structural parsing (ignore unknown keys).
- Breaking changes bump `v`. The TS adapter negotiates in `hello` once we ship v1 — it'll include `{ acceptVersions: [0, 1] }` and the sidecar picks the highest it supports.
- v0.1 pins both sides to `"v": 0`.
