/**
 * @kithjs/client — TypeScript client for @kithjs/server.
 *
 * Usage:
 *   import { KithClient } from "@kithjs/client";
 *
 *   const kith = new KithClient({ baseUrl: "http://localhost:3040" });
 *   await kith.connect();
 *
 *   kith.on((event) => {
 *     if (event.type === "tts_audio_chunk") playAudio(event.audioB64);
 *   });
 *
 *   await kith.speak("Hello from Kith!");
 *   await kith.disconnect();
 */

import type { KithEvent, EventHandler, Unsubscribe } from "@kithjs/core";

export interface KithClientOptions {
  /** Base URL of the Kith server (e.g. "http://localhost:3040") */
  baseUrl: string;
  /** Character ID to use when creating sessions */
  characterId?: string;
  /** Auto-connect on construction. Default: false */
  autoConnect?: boolean;
}

export class KithClient {
  private baseUrl: string;
  private characterId?: string;
  private _sessionId: string | null = null;
  private ws: WebSocket | null = null;
  private handlers = new Set<EventHandler>();
  private _connected = false;

  constructor(options: KithClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.characterId = options.characterId;
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  get connected(): boolean {
    return this._connected;
  }

  /** Create a session and open a WebSocket connection. */
  async connect(): Promise<string> {
    // Create session via HTTP
    const res = await fetch(`${this.baseUrl}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: this.characterId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "unknown" }));
      throw new Error(`Failed to create session: ${(err as any).error}`);
    }

    const data = (await res.json()) as { sessionId: string; wsUrl: string };
    this._sessionId = data.sessionId;

    // Build WS URL from base URL
    const wsBase = this.baseUrl.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/ws?sessionId=${this._sessionId}`;

    // Open WebSocket
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        this._connected = true;
      };

      ws.onmessage = (e) => {
        let event: KithEvent;
        try {
          event = JSON.parse(typeof e.data === "string" ? e.data : String(e.data));
        } catch {
          return;
        }

        if ((event as any).type === "_ready") {
          resolve();
          return;
        }

        for (const h of this.handlers) {
          try {
            h(event);
          } catch {
            // handler error
          }
        }
      };

      ws.onclose = () => {
        this._connected = false;
      };

      ws.onerror = (err) => {
        reject(new Error(`WebSocket error: ${err}`));
      };

      // Timeout after 10s
      setTimeout(() => reject(new Error("WebSocket connect timeout")), 10000);
    });

    return this._sessionId;
  }

  /** Disconnect and destroy the session. */
  async disconnect(): Promise<void> {
    if (this._sessionId) {
      await fetch(`${this.baseUrl}/sessions/${this._sessionId}`, {
        method: "DELETE",
      }).catch(() => {});
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    this._connected = false;
    this._sessionId = null;
  }

  /** Send text to be spoken. */
  async speak(text: string): Promise<void> {
    if (!this._sessionId) throw new Error("Not connected");

    // Send via WS for lowest latency
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "speak", text }));
      return;
    }

    // Fallback to HTTP
    const res = await fetch(`${this.baseUrl}/sessions/${this._sessionId}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`speak failed: ${res.status}`);
    }
  }

  /** Stop any in-flight TTS. */
  async bargeIn(): Promise<void> {
    if (!this._sessionId) throw new Error("Not connected");

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "barge-in" }));
      return;
    }

    await fetch(`${this.baseUrl}/sessions/${this._sessionId}/barge-in`, {
      method: "POST",
    });
  }

  /** Subscribe to KithEvents. */
  on(handler: EventHandler): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /** Get server health status. */
  async health(): Promise<{ ok: boolean; sessions: number; uptime: number }> {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json() as any;
  }

  /** List available character profiles. */
  async characters(): Promise<{ id: string; personaMode?: string }[]> {
    const res = await fetch(`${this.baseUrl}/characters`);
    return res.json() as any;
  }
}
