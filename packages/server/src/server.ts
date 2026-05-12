/**
 * KithServer — standalone voice microservice.
 *
 * Framework-agnostic HTTP/WebSocket server. POST text, get streaming audio.
 *
 * Endpoints:
 *   POST   /sessions              — create session { characterId? } → { sessionId, wsUrl }
 *   DELETE /sessions/:id          — destroy session
 *   POST   /sessions/:id/speak    — send text { text } → audio via WS/SSE
 *   POST   /sessions/:id/barge-in — stop current TTS
 *   GET    /sessions/:id/events   — SSE stream (fallback)
 *   WS     /ws?sessionId=xxx      — full duplex WebSocket
 *   GET    /characters            — list character profiles
 *   GET    /health                — { ok, sessions, uptime }
 */

import path from "node:path";
import type { ServerWebSocket } from "bun";

import { CharacterRegistry } from "./character-registry.ts";
import { SessionManager, type SessionConfig } from "./session.ts";

export interface KithServerOptions {
  port?: number;
  characterDir?: string;
  defaultCharacterId?: string;
  pythonPath?: string;
  pythonCwd?: string;
  corsOrigins?: string;
  maxSessions?: number;
  pipeline?: string;
  apiKey?: string;
  voiceId?: string;
  modelId?: string;
  pipelineConfig?: Record<string, unknown>;
}

interface WsData {
  sessionId: string;
}

export class KithServer {
  private options: Required<KithServerOptions>;
  private characters: CharacterRegistry;
  private sessions: SessionManager;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private startedAt = 0;

  constructor(opts: KithServerOptions = {}) {
    const root = path.dirname(Bun.fileURLToPath(import.meta.url));

    this.options = {
      port: opts.port ?? Number(process.env.PORT ?? 3040),
      characterDir: opts.characterDir ?? process.env.KITH_CHARACTER_DIR ?? "./characters",
      defaultCharacterId: opts.defaultCharacterId ?? process.env.KITH_DEFAULT_CHARACTER ?? "",
      pythonPath:
        opts.pythonPath ??
        process.env.PIPECAT_PYTHON_PATH ??
        path.resolve(root, "../node_modules/@kithjs/runtime-pipecat/python/.venv/bin/python"),
      pythonCwd:
        opts.pythonCwd ??
        process.env.PIPECAT_PYTHON_CWD ??
        path.resolve(root, "../node_modules/@kithjs/runtime-pipecat/python"),
      corsOrigins: opts.corsOrigins ?? process.env.KITH_CORS ?? "*",
      maxSessions: opts.maxSessions ?? 100,
      pipeline: opts.pipeline ?? process.env.KITH_PIPELINE ?? "elevenlabs",
      apiKey: opts.apiKey ?? process.env.ELEVENLABS_API_KEY ?? "",
      voiceId: opts.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "",
      modelId: opts.modelId ?? process.env.ELEVENLABS_MODEL_ID ?? "eleven_v3",
      pipelineConfig: opts.pipelineConfig ?? {},
    };

    if (!this.options.apiKey) {
      console.error("[kith] ELEVENLABS_API_KEY is required. Set it via env or options.");
      process.exit(2);
    }

    this.characters = new CharacterRegistry(this.options.characterDir);

    const sessionConfig: SessionConfig = {
      pythonPath: this.options.pythonPath,
      pythonCwd: this.options.pythonCwd,
      apiKey: this.options.apiKey,
      voiceId: this.options.voiceId,
      modelId: this.options.modelId,
      pipelineConfig: {
        pipeline: this.options.pipeline,
        ...this.options.pipelineConfig,
      },
    };

    this.sessions = new SessionManager(sessionConfig, this.options.maxSessions);
  }

  async start(): Promise<void> {
    await this.characters.load();
    this.startedAt = Date.now();

    const self = this;

    this.server = Bun.serve<WsData>({
      port: this.options.port,

      async fetch(req, server) {
        return self.handleRequest(req, server);
      },

      websocket: {
        async open(ws: ServerWebSocket<WsData>) {
          const { sessionId } = ws.data;
          console.log(`[kith] ws open session=${sessionId}`);

          // Attach to existing session or create new one
          if (self.sessions.has(sessionId)) {
            self.sessions.attachWs(sessionId, ws);
            ws.send(JSON.stringify({ type: "_ready", sessionId }));
          } else {
            try {
              const charId = self.options.defaultCharacterId;
              const character = charId ? self.characters.get(charId) : undefined;
              await self.sessions.create(sessionId, character, ws);
              ws.send(JSON.stringify({ type: "_ready", sessionId }));
            } catch (err) {
              console.error(`[kith] session create failed:`, err);
              ws.close(1011, "session create failed");
            }
          }
        },

        async message(ws: ServerWebSocket<WsData>, raw) {
          const { sessionId } = ws.data;
          const session = self.sessions.get(sessionId);
          if (!session) return;

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
              console.error(`[kith] speak failed session=${sessionId}:`, err);
            }
          } else if (msg.type === "barge-in") {
            await session.runtime.bargeIn();
          }
        },

        async close(ws: ServerWebSocket<WsData>) {
          const { sessionId } = ws.data;
          console.log(`[kith] ws close session=${sessionId}`);
          await self.sessions.destroy(sessionId);
        },
      },
    });

    console.log(`[kith] server listening on http://localhost:${this.server.port}`);
  }

  async stop(): Promise<void> {
    this.server?.stop();
  }

  private async handleRequest(
    req: Request,
    server: { upgrade: (req: Request, opts: any) => boolean },
  ): Promise<Response | undefined> {
    const url = new URL(req.url);
    const cors = this.corsHeaders();

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const sessionId = url.searchParams.get("sessionId") ?? crypto.randomUUID();
      const ok = server.upgrade(req, { data: { sessionId } });
      if (ok) return undefined;
      return this.json({ error: "WebSocket upgrade failed" }, 500, cors);
    }

    // POST /sessions — create session
    if (url.pathname === "/sessions" && req.method === "POST") {
      try {
        const body = (await req.json().catch(() => ({}))) as { characterId?: string };
        const sessionId = crypto.randomUUID();
        const character = body.characterId ? this.characters.get(body.characterId) : undefined;
        await this.sessions.create(sessionId, character);
        return this.json(
          {
            sessionId,
            wsUrl: `ws://localhost:${this.options.port}/ws?sessionId=${sessionId}`,
          },
          201,
          cors,
        );
      } catch (err: any) {
        return this.json({ error: err.message }, 500, cors);
      }
    }

    // DELETE /sessions/:id
    const deleteMatch = url.pathname.match(/^\/sessions\/([^/]+)$/);
    if (deleteMatch && req.method === "DELETE") {
      await this.sessions.destroy(deleteMatch[1]);
      return this.json({ ok: true }, 200, cors);
    }

    // POST /sessions/:id/speak
    const speakMatch = url.pathname.match(/^\/sessions\/([^/]+)\/speak$/);
    if (speakMatch && req.method === "POST") {
      const session = this.sessions.get(speakMatch[1]);
      if (!session) {
        return this.json({ error: "session not found" }, 404, cors);
      }
      try {
        const body = (await req.json()) as { text: string };
        if (!body.text) return this.json({ error: "text is required" }, 400, cors);
        session.voice.speak(body.text).catch((err) => {
          console.error(`[kith] speak failed:`, err);
        });
        return this.json({ ok: true, sessionId: speakMatch[1] }, 200, cors);
      } catch (err: any) {
        return this.json({ error: err.message }, 500, cors);
      }
    }

    // POST /sessions/:id/barge-in
    const bargeMatch = url.pathname.match(/^\/sessions\/([^/]+)\/barge-in$/);
    if (bargeMatch && req.method === "POST") {
      const session = this.sessions.get(bargeMatch[1]);
      if (!session) return this.json({ error: "session not found" }, 404, cors);
      await session.runtime.bargeIn();
      return this.json({ ok: true }, 200, cors);
    }

    // GET /sessions/:id/events — SSE stream
    const sseMatch = url.pathname.match(/^\/sessions\/([^/]+)\/events$/);
    if (sseMatch && req.method === "GET") {
      const session = this.sessions.get(sseMatch[1]);
      if (!session) return this.json({ error: "session not found" }, 404, cors);

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          const unsub = session.voice.on((event) => {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            } catch {
              unsub();
            }
          });

          // Flush buffered events
          for (const event of session.eventBuffer) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
          session.eventBuffer.length = 0;
        },
      });

      return new Response(stream, {
        headers: {
          ...cors,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // GET /characters
    if (url.pathname === "/characters" && req.method === "GET") {
      return this.json(this.characters.list(), 200, cors);
    }

    // GET /health
    if (url.pathname === "/health") {
      const stats = this.sessions.stats();
      return this.json(
        {
          ok: true,
          sessions: stats.count,
          uptime: (Date.now() - this.startedAt) / 1000,
        },
        200,
        cors,
      );
    }

    return this.json(
      { name: "@kithjs/server", docs: "https://kith.weshuber.com" },
      200,
      cors,
    );
  }

  private json(data: unknown, status: number, headers: Record<string, string> = {}): Response {
    return Response.json(data, {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  private corsHeaders(): Record<string, string> {
    return {
      "Access-Control-Allow-Origin": this.options.corsOrigins,
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-kith-session",
    };
  }
}
