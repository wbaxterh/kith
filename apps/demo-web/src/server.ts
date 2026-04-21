/**
 * Kith reference web demo server.
 *
 * Architecture:
 *   Browser ← WS → this server ← WS → Python sidecar
 *
 * Each browser session gets its own PipecatRuntime (= its own Python
 * subprocess). For a demo that's fine; for production you'd pool or persist.
 */

import path from "node:path";
import type { KithEvent } from "@kith/core";
import { PipecatRuntime } from "@kith/runtime-pipecat";
import { VoiceRouter } from "@kith/voice-router";
import type { ServerWebSocket } from "bun";

const PORT = Number(process.env.PORT ?? 3030);
const ROOT = path.dirname(Bun.fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(ROOT, "../public");
const PYTHON_VENV = path.resolve(ROOT, "../../../packages/runtime-pipecat/python/.venv/bin/python");
const PYTHON_CWD = path.resolve(ROOT, "../../../packages/runtime-pipecat/python");

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID;
const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

if (apiKey === undefined || voiceId === undefined) {
  console.error("ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID must be set (see .env.example)");
  process.exit(2);
}

interface Session {
  runtime: PipecatRuntime;
  voice: VoiceRouter;
  unsubscribe: () => void;
}

type Sock = ServerWebSocket<{ sessionId: string }>;

const sessions = new Map<string, Session>();

const server = Bun.serve<{ sessionId: string }>({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const sessionId = crypto.randomUUID();
      const ok = server.upgrade(req, { data: { sessionId } });
      if (ok) return undefined;
      return new Response("upgrade failed", { status: 500 });
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file(path.join(PUBLIC_DIR, "index.html")));
    }

    return new Response("not found", { status: 404 });
  },
  websocket: {
    async open(ws: Sock) {
      const { sessionId } = ws.data;
      console.log(`[ws] open session=${sessionId}`);

      const runtime = new PipecatRuntime({
        pythonPath: PYTHON_VENV,
        cwd: PYTHON_CWD,
        config: {
          pipeline: "elevenlabs",
          apiKey,
          voiceId,
          modelId,
          stability: 0.5,
          similarityBoost: 0.85,
          style: 0.3,
          useSpeakerBoost: true,
          outputFormat: "mp3_44100_128",
        },
      });

      const unsubscribe = runtime.on((event: KithEvent) => {
        try {
          ws.send(JSON.stringify(event));
        } catch {
          // ws closed; swallow
        }
      });

      try {
        await runtime.connect({ sessionId });
      } catch (err) {
        console.error(`[ws] runtime connect failed for session=${sessionId}:`, err);
        ws.close(1011, "runtime connect failed");
        return;
      }

      const voice = new VoiceRouter({ runtime });
      sessions.set(sessionId, { runtime, voice, unsubscribe });

      ws.send(JSON.stringify({ type: "_ready", sessionId }));
    },
    async message(ws: Sock, raw) {
      const { sessionId } = ws.data;
      const session = sessions.get(sessionId);
      if (session === undefined) return;

      let msg: { type: string; text?: string };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (msg.type === "speak" && typeof msg.text === "string") {
        try {
          await session.voice.speak(msg.text);
        } catch (err) {
          console.error(`[ws] speak failed for session=${sessionId}:`, err);
        }
      } else if (msg.type === "barge-in") {
        await session.runtime.bargeIn();
      }
    },
    async close(ws: Sock) {
      const { sessionId } = ws.data;
      const session = sessions.get(sessionId);
      if (session === undefined) return;
      sessions.delete(sessionId);
      session.unsubscribe();
      try {
        await session.runtime.disconnect();
      } catch (err) {
        console.error(`[ws] disconnect failed for session=${sessionId}:`, err);
      }
      console.log(`[ws] close session=${sessionId}`);
    },
  },
});

console.log(`Kith demo listening on http://localhost:${server.port}`);
