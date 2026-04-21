# @kith/demo-web

Reference web demo for Kith. Type text → Kith speaks it via ElevenLabs → procedural avatar reacts to audio amplitude.

## Run

From the repo root:

```bash
# one-time setup (first clone only)
bun install
cd packages/runtime-pipecat/python
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e .
cd ../../../

# set your keys
cp apps/demo-web/.env.example apps/demo-web/.env
# edit apps/demo-web/.env: add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID

# run
cd apps/demo-web
bun run dev
```

Open <http://localhost:3030>.

## What to try

- Type a sentence, press Speak (or ⌘/Ctrl+Enter). Audio plays, avatar mouth scales with amplitude.
- Type something longer (2-3 sentences). Notice each sentence is synthesized as its own chunk — the voice stays natural through the pauses.
- Hit **Stop** mid-speech to barge in.

## What's in here

One Bun server (`src/server.ts`) that:
- Serves `public/index.html`
- Opens a per-session WebSocket for the browser
- Each session spawns its own `PipecatRuntime` + `VoiceRouter`
- Forwards normalized `KithEvent`s to the browser

The browser client is plain HTML + vanilla JS (no bundler). Canvas draws a procedural face; Web Audio API handles chunked MP3 playback and amplitude analysis drives the mouth.

Deferred to v0.2 of Kith:
- Mic input (mic → STT → agent → TTS round-trip)
- Real VRM avatar with phoneme-to-viseme lipsync
