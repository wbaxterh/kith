---
sidebar_position: 100
---

# Roadmap

## Our Mission

**Build AI companions you actually own.**

We believe everyone should be able to create an AI companion that runs on their hardware, speaks with a voice they choose, remembers their conversations, and answers to them — not a corporation. No API bills. No data leaving your machine. No company deciding what your companion can or can't say.

Kith is the open-source toolkit that makes this possible.

---

## What's Shipped

### v0.1 — Foundation

The core voice quality layer. 10 npm packages under `@kithjs/*`.

- **Core contracts** — 5 adapter interfaces, 12-event normalized bus
- **Pipecat runtime** — Python sidecar with ElevenLabs TTS, auto-respawn, barge-in
- **Voice router** — Sentence-aware chunking, 4 slang dicts, pronunciation, emoji-to-emotion, VoiceCharacter profiles, laugh tags
- **LiveKit adapter** — WebRTC production adapter + mock mode
- **Observability** — Traces, dup-send guards, reconnect metrics
- **Avatar events** — Viseme-to-blend-shape mapping, expression state machine

### v0.2 — Multi-Provider + Framework Plugins

Production reliability and framework integrations.

- **Multi-provider TTS fallback** — ElevenLabs + OpenAI TTS + Cartesia with circuit breaker
- **Mic input / STT** — Whisper + Deepgram, VAD silence detection
- **OpenClaw plugin** — `openclaw plugins install @kithjs/openclaw`
- **React Native support** — LiveKit RN SDK helpers

### v0.3 — Standalone Server + ElizaOS

Drop-in voice for any framework.

- **@kithjs/server** — Standalone voice microservice (REST + WS + SSE + Docker)
- **@kithjs/client** — TypeScript client for the server
- **@kithjs/elizaos** — Drop-in replacement for `plugin-elevenlabs` with `ElevenLabsDirectAdapter` (no Python needed)
- **Local TTS pipelines** — Piper (CPU, runs on Raspberry Pi) and Voxtral (GPU, voice cloning from 5 seconds of audio)

---

## What's Next

### v0.4 — Own Your Companion

The local-first companion stack. No cloud APIs required.

| Feature | Description | Status |
|---------|-------------|--------|
| **Local TTS (Piper)** | CPU-only TTS that runs on any machine. No GPU, no API key, no internet. | Pipeline built |
| **Local TTS (Voxtral)** | GPU-accelerated TTS with voice cloning from 3-5 seconds of audio. Your companion, your voice. | Pipeline built |
| **Ollama adapter** | Connect VoiceRouter to local LLMs via Ollama. Full voice conversation with zero cloud dependency. | Next |
| **@kithjs/companion** | Generalized relationship system — progression (stranger → bestie), memory, personality adaptation, greeting engine. From the Kaori integration, available to all. | Next |
| **Emotion-aware voice** | Detected emotions feed back into TTS parameters. Excited text → higher energy voice. Sad text → softer tone. | Next |
| **Character creator UI** | Web interface: name your companion, describe their personality, record voice for cloning, export VoiceCharacter JSON. No code needed. | Planned |

### v0.5 — One-Click Companion

| Feature | Description |
|---------|-------------|
| **`docker run kithjs/companion`** | Single Docker image: Ollama + Piper/Voxtral + Kith server + web UI. Your companion runs on your machine, fully offline. |
| **Open-source STT** | Local Whisper (whisper.cpp) replacing the cloud Whisper API for fully offline STT. |
| **Conversation export** | Export your companion's memory and conversations. Your data, always portable. |
| **Multi-companion** | Run multiple characters with different personalities on the same server. |

### Future

| Feature | Description |
|---------|-------------|
| **Telephony** | SIP/PSTN via LiveKit — call your companion from a phone |
| **Mobile app** | React Native companion app with local or cloud voice |
| **Federated memory** | Share companion knowledge between instances without centralizing data |
| **Plugin marketplace** | Community-built character profiles, voices, and transforms |

---

## The Stack (Where We're Heading)

```
┌─────────────────────────────────────────┐
│              Your Companion              │
│  Character · Personality · Memory · Voice│
└──────────┬──────────────────┬───────────┘
           │                  │
    ┌──────▼──────┐   ┌──────▼──────┐
    │  Brain      │   │  Voice      │
    │  (your LLM) │   │  (Kith)     │
    │             │   │             │
    │ Ollama      │   │ VoiceRouter │
    │ Claude      │   │ + TTS       │
    │ GPT         │   │ + Emotion   │
    │ Llama       │   │ + Avatar    │
    └─────────────┘   └─────────────┘
           │                  │
    ┌──────▼──────┐   ┌──────▼──────┐
    │  Cloud      │   │  Local      │
    │  (optional) │   │  (default)  │
    │             │   │             │
    │ OpenRouter  │   │ Piper (CPU) │
    │ Anthropic   │   │ Voxtral     │
    │ OpenAI      │   │ Whisper.cpp │
    └─────────────┘   └─────────────┘
```

**Cloud is optional. Local is the default.** Use cloud providers when you want the best quality. Use local when you want privacy, zero cost, and full control.

---

## Philosophy

1. **Your companion, your data.** Conversations never leave your machine unless you choose to use a cloud provider.
2. **No vendor lock-in.** Swap TTS providers, LLMs, or runtimes without changing your companion code.
3. **Accessible to everyone.** You shouldn't need to be a developer to create a companion. Character creator, one-click deploy, no-code setup.
4. **Open source forever.** MIT licensed. The core toolkit will always be free.
5. **Emotion is not optional.** A companion that sounds robotic isn't a companion. Natural voice, real laughter, emotional awareness — these are table stakes.

---

## Contributing

We welcome contributions at every level:

- **Local TTS providers** — Kokoro, Fish Speech, MOSS-TTS, Qwen3-TTS
- **Ollama / local LLM integration**
- **Character profiles** — share your companion personalities
- **Framework plugins** — LangGraph, CrewAI, AutoGen adapters
- **Voice models** — cloned voices, accent support
- **Documentation** — guides, tutorials, translations
- **Bug reports** — from real deployments

GitHub: [github.com/wbaxterh/kith](https://github.com/wbaxterh/kith)
