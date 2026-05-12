/**
 * Session manager — tracks per-client voice sessions.
 *
 * Each session owns a PipecatRuntime + VoiceRouter pair. Sessions can be
 * created via HTTP (before a WebSocket connects) or on WS open.
 */

import type { KithEvent } from "@kithjs/core";
import { PipecatRuntime } from "@kithjs/runtime-pipecat";
import { InMemoryObservability, consoleExporter } from "@kithjs/observability";
import {
  DEFAULT_BOARD_SPORTS_SLANG,
  DEFAULT_ENGLISH_SLANG,
  DEFAULT_GENZ_SLANG,
  DEFAULT_LAUGH_TAGS,
  VoiceRouter,
  voiceCharacterToRuntimeConfig,
  type VoiceCharacter,
} from "@kithjs/voice-router";

import type { ServerWebSocket } from "bun";

export interface SessionConfig {
  pythonPath: string;
  pythonCwd: string;
  apiKey: string;
  voiceId: string;
  modelId: string;
  pipelineConfig?: Record<string, unknown>;
}

export interface Session {
  id: string;
  runtime: PipecatRuntime;
  voice: VoiceRouter;
  obs: InMemoryObservability;
  unsubscribe: () => void;
  ws: ServerWebSocket<{ sessionId: string }> | null;
  character: VoiceCharacter | undefined;
  eventBuffer: KithEvent[];
  createdAt: number;
}

/** Clean AI-generated text for natural TTS output. */
function cleanForTTS(text: string): string {
  let t = text;
  t = t.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/([!?.]){2,}/g, "$1");
  t = t.replace(/([a-z])\1{3,}/gi, "$1$1");
  t = t.replace(/:[a-z_]+:/g, "");
  return t;
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private config: SessionConfig;
  private maxSessions: number;
  private bufferTtlMs = 30_000;

  constructor(config: SessionConfig, maxSessions = 100) {
    this.config = config;
    this.maxSessions = maxSessions;
  }

  async create(
    sessionId: string,
    character?: VoiceCharacter,
    ws?: ServerWebSocket<{ sessionId: string }> | null,
  ): Promise<Session> {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`max sessions reached (${this.maxSessions})`);
    }

    const obs = new InMemoryObservability();
    obs.onRecord(consoleExporter);

    const runtimeConfig: Record<string, unknown> = {
      pipeline: this.config.pipelineConfig?.pipeline ?? "elevenlabs",
      apiKey: this.config.apiKey,
      voiceId: this.config.voiceId,
      modelId: this.config.modelId,
      ...(this.config.pipelineConfig ?? {}),
      ...(character ? voiceCharacterToRuntimeConfig(character) : {}),
      outputFormat: "mp3_44100_128",
    };

    const runtime = new PipecatRuntime({
      pythonPath: this.config.pythonPath,
      cwd: this.config.pythonCwd,
      observability: obs,
      config: runtimeConfig,
    });

    await runtime.connect({ sessionId });

    const slang = {
      ...DEFAULT_ENGLISH_SLANG,
      ...DEFAULT_GENZ_SLANG,
      ...DEFAULT_BOARD_SPORTS_SLANG,
      ...DEFAULT_LAUGH_TAGS,
      ...(character?.slang ?? {}),
    };

    const voice = new VoiceRouter({
      runtime,
      character,
      slang,
      transforms: [cleanForTTS],
    });

    const eventBuffer: KithEvent[] = [];

    const unsubscribe = voice.on((event: KithEvent) => {
      if (ws) {
        try {
          ws.send(JSON.stringify(event));
        } catch {
          // ws closed
        }
      } else {
        // Buffer events until a WS/SSE client connects
        eventBuffer.push(event);
        if (eventBuffer.length > 200) eventBuffer.shift();
      }
    });

    const session: Session = {
      id: sessionId,
      runtime,
      voice,
      obs,
      unsubscribe,
      ws: ws ?? null,
      character,
      eventBuffer,
      createdAt: Date.now(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  attachWs(sessionId: string, ws: ServerWebSocket<{ sessionId: string }>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.ws = ws;

    // Flush buffered events
    for (const event of session.eventBuffer) {
      try {
        ws.send(JSON.stringify(event));
      } catch {
        break;
      }
    }
    session.eventBuffer.length = 0;

    return true;
  }

  async destroy(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    session.unsubscribe();
    session.voice.destroy();
    try {
      await session.runtime.disconnect();
    } catch (err) {
      console.error(`[kith] disconnect failed session=${sessionId}:`, err);
    }
    console.log(`[kith] session torn down: ${sessionId}`);
  }

  stats(): { count: number; ids: string[] } {
    return {
      count: this.sessions.size,
      ids: [...this.sessions.keys()],
    };
  }
}
