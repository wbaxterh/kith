/**
 * PipecatRuntime — Kith RuntimeAdapter backed by a Python Pipecat sidecar.
 *
 * Lifecycle:
 *   1. `connect(config)` spawns the sidecar, parses its ready line, opens a
 *      WebSocket, sends `hello`, and resolves when the sidecar emits `ready`.
 *   2. Inbound events are decoded and fanned out to subscribers registered
 *      via `on(handler)`. The sidecar-internal `ready` event is filtered out
 *      of the public bus.
 *   3. `disconnect()` sends a graceful `disconnect` op, closes the WebSocket,
 *      and waits for the subprocess to exit.
 */

import type {
  EventHandler,
  KithEvent,
  RuntimeAdapter,
  RuntimeConfig,
  Unsubscribe,
} from "@kith/core";

import { type Op, toKithEvent, type WireEvent } from "./envelope.ts";
import { type SidecarHandle, type SidecarOptions, spawnSidecar } from "./sidecar.ts";

export interface PipecatRuntimeOptions extends SidecarOptions {
  /** Opaque config forwarded to the sidecar in the `hello` op. Shape is defined
   * by the Python-side pipeline (e.g., TTS provider, voice IDs). */
  config?: Record<string, unknown>;
}

export class PipecatRuntime implements RuntimeAdapter {
  private readonly options: PipecatRuntimeOptions;
  private readonly handlers = new Set<EventHandler>();
  private sidecar: SidecarHandle | null = null;
  private ws: WebSocket | null = null;

  constructor(options: PipecatRuntimeOptions = {}) {
    this.options = options;
  }

  async connect(config: RuntimeConfig): Promise<void> {
    if (this.sidecar !== null) {
      throw new Error("PipecatRuntime already connected");
    }

    const sidecar = await spawnSidecar(this.options);
    this.sidecar = sidecar;

    const ws = new WebSocket(`ws://127.0.0.1:${sidecar.port}/`);
    this.ws = ws;

    await waitForOpen(ws);
    ws.addEventListener("message", (e) => this.onMessage(e));
    ws.addEventListener("close", () => {
      this.ws = null;
    });

    const ready = waitForReady(ws);
    this.send({
      v: 0,
      op: "hello",
      sessionId: config.sessionId,
      config: this.options.config ?? {},
    });
    await ready;
  }

  async disconnect(): Promise<void> {
    const sidecar = this.sidecar;
    const ws = this.ws;
    this.sidecar = null;
    this.ws = null;

    if (ws !== null && ws.readyState === WebSocket.OPEN) {
      try {
        this.sendOn(ws, { v: 0, op: "disconnect" });
      } catch {
        // ignore — shutting down anyway
      }
      ws.close();
    }

    if (sidecar !== null) {
      // Give the sidecar a moment to exit cleanly, then SIGTERM.
      const exitSignal = AbortSignal.timeout(2000);
      const raced = await Promise.race([
        sidecar.exited,
        new Promise<"timeout">((resolve) => {
          exitSignal.addEventListener("abort", () => resolve("timeout"));
        }),
      ]);
      if (raced === "timeout") {
        sidecar.process.kill();
      }
    }
  }

  async sendText(text: string): Promise<void> {
    this.send({ v: 0, op: "sendText", text });
  }

  async sendAudio(audio: ArrayBuffer): Promise<void> {
    this.send({
      v: 0,
      op: "sendAudio",
      audioB64: base64FromArrayBuffer(audio),
      sampleRate: 16000,
    });
  }

  async bargeIn(): Promise<void> {
    this.send({ v: 0, op: "bargeIn" });
  }

  on(handler: EventHandler): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private send(op: Op): void {
    const ws = this.ws;
    if (ws === null || ws.readyState !== WebSocket.OPEN) {
      throw new Error("PipecatRuntime not connected");
    }
    this.sendOn(ws, op);
  }

  private sendOn(ws: WebSocket, op: Op): void {
    ws.send(JSON.stringify(op));
  }

  private onMessage(e: MessageEvent): void {
    const raw = typeof e.data === "string" ? e.data : "";
    if (raw === "") return;

    let wire: WireEvent;
    try {
      wire = JSON.parse(raw) as WireEvent;
    } catch {
      return; // malformed; sidecar should have emitted a proper error event
    }

    const event = toKithEvent(wire);
    if (event === null) return; // `ready` — internal only

    for (const handler of this.handlers) {
      try {
        const out = handler(event as KithEvent);
        if (out !== undefined) void out;
      } catch (err) {
        // Handler errors are swallowed per the `EventHandler` contract —
        // throwing is "logged, not thrown back."
        console.error("kith: handler threw", err);
      }
    }
  }
}

function waitForOpen(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("error", onError);
      reject(new Error("WebSocket failed to open"));
    };
    ws.addEventListener("open", onOpen);
    ws.addEventListener("error", onError);
  });
}

function waitForReady(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      const raw = typeof e.data === "string" ? e.data : "";
      try {
        const wire = JSON.parse(raw) as WireEvent;
        if (wire.event === "ready") {
          ws.removeEventListener("message", onMessage);
          resolve();
        }
      } catch {
        // ignore; wait for a valid ready event
      }
    };
    ws.addEventListener("message", onMessage);
    AbortSignal.timeout(10_000).addEventListener("abort", () => {
      ws.removeEventListener("message", onMessage);
      reject(new Error("sidecar did not emit ready event within 10s"));
    });
  });
}

function base64FromArrayBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}
