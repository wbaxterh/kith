---
sidebar_position: 3
---

# Deployment

How to deploy a Kith-powered companion to production.

## Architecture Overview

A typical production setup has three processes:

1. **Your backend** — handles auth, AI generation, business logic
2. **Kith voice sidecar** — Bun process running PipecatRuntime + VoiceRouter
3. **Python sidecar** — spawned automatically by PipecatRuntime

The browser connects to the Kith sidecar via WebSocket. Your backend fires text to the sidecar via HTTP POST.

## Environment Variables

```bash
# Required
ELEVENLABS_API_KEY=sk_your_key
ELEVENLABS_VOICE_ID=your_voice_id

# Optional
ELEVENLABS_MODEL_ID=eleven_v3  # default
PORT=3040                       # sidecar port
```

## Server Setup

### 1. Install Dependencies

```bash
# Node/Bun dependencies
bun install

# Python sidecar
cd packages/runtime-pipecat/python
uv venv --python 3.11
source .venv/bin/activate
uv pip install -e .
```

### 2. Run with PM2

```bash
# Start the Kith sidecar
pm2 start "bun src/server.ts" --name kith-voice --cwd /path/to/kith-voice

# Verify
pm2 logs kith-voice
curl http://localhost:3040/health
```

### 3. Reverse Proxy (nginx)

```nginx
# WebSocket endpoint for browser clients
location /kith/ws {
    proxy_pass http://127.0.0.1:3040/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}

# HTTP endpoint for backend to trigger speech
location /kith/ {
    proxy_pass http://127.0.0.1:3040/;
}
```

## Health Check

The sidecar exposes a health endpoint:

```bash
curl http://localhost:3040/health
# {"ok":true,"sessions":2,"uptime":3600.5}
```

## Scaling Considerations

- Each browser session spawns its own PipecatRuntime (Python subprocess)
- Memory usage: ~50-100MB per active session
- For high concurrency, consider running multiple sidecar instances behind a load balancer with sticky sessions (WebSocket affinity)
- The sidecar is stateful per session — sessions cannot be migrated between instances
