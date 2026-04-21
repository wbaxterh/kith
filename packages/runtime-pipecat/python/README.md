# kith-runtime-pipecat (Python sidecar)

The Python process spawned by `@kith/runtime-pipecat`. You normally don't run this directly — the TS adapter manages its lifecycle.

## Manual run (for debugging)

Requires Python 3.11+ and [uv](https://docs.astral.sh/uv/) (or pip).

```bash
cd packages/runtime-pipecat/python
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e .

python -m kith_runtime
# → KITH_RUNTIME_READY port=54321
```

Then connect any WebSocket client to `ws://127.0.0.1:54321/` and send envelopes per [`docs/protocol.md`](../../../docs/protocol.md).

## v0.1 status

- Day 3 (current): mock pipeline. TTS is simulated on `asyncio.sleep` — no real synthesis.
- Day 4: real Pipecat pipeline (STT + LLM text-passthrough + TTS services) behind the same `Pipeline` protocol. Install with `uv pip install -e .[pipecat]`.
