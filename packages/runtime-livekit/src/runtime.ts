/**
 * LiveKitRuntime — Kith RuntimeAdapter backed by LiveKit.
 *
 * v0.1 scope: portability proof, not production path. This adapter ships with
 * a built-in **local mock mode** that simulates the LiveKit event flow without
 * requiring a LiveKit server. A real LiveKit integration (WebRTC rooms, server
 * SDK) is planned for v0.2.
 *
 * The mock mode exercises the full RuntimeAdapter contract:
 *   connect → sendText → tts_start / tts_audio_chunk / tts_end → disconnect
 *
 * This proves that consumers can swap PipecatRuntime for LiveKitRuntime
 * without changing their VoiceRouter, event handling, or avatar code.
 */

import type {
  EventHandler,
  KithEvent,
  RuntimeAdapter,
  RuntimeConfig,
  Unsubscribe,
} from "@kith/core";

export interface LiveKitRuntimeOptions {
  /**
   * LiveKit server URL. When omitted (or set to "mock"), the adapter runs in
   * local mock mode — no network calls, deterministic event timing. This is
   * the only mode supported in v0.1.
   */
  url?: string;
  /** API key for LiveKit Cloud. Unused in mock mode. */
  apiKey?: string;
  /** API secret for LiveKit Cloud. Unused in mock mode. */
  apiSecret?: string;
  /** Simulated chunk delay in ms (mock mode only). Default: 50. */
  mockChunkDelayMs?: number;
  /** Number of simulated audio chunks per sendText call. Default: 3. */
  mockChunkCount?: number;
}

export class LiveKitRuntime implements RuntimeAdapter {
  private readonly options: LiveKitRuntimeOptions;
  private readonly handlers = new Set<EventHandler>();
  private connected = false;
  private sessionId: string | null = null;
  private turnCounter = 0;
  private chunkCounter = 0;

  constructor(options: LiveKitRuntimeOptions = {}) {
    this.options = options;
  }

  async connect(config: RuntimeConfig): Promise<void> {
    if (this.connected) {
      throw new Error("LiveKitRuntime already connected");
    }

    const url = this.options.url ?? "mock";

    if (url !== "mock") {
      throw new Error(
        "LiveKitRuntime v0.1 only supports mock mode. " +
          "Real LiveKit integration is planned for v0.2. " +
          'Omit the `url` option or set it to "mock".',
      );
    }

    this.sessionId = config.sessionId;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.sessionId = null;
  }

  async sendText(text: string): Promise<void> {
    this.assertConnected();

    const turnId = `lk-turn-${++this.turnCounter}`;
    const chunkCount = this.options.mockChunkCount ?? 3;
    const chunkDelay = this.options.mockChunkDelayMs ?? 50;

    // Emit turn_start
    this.dispatch({
      type: "turn_start",
      timestamp: Date.now(),
      turnId,
      role: "assistant",
    });

    // Emit tts_start → N × tts_audio_chunk → tts_end
    const chunkId = `lk-chunk-${++this.chunkCounter}`;

    this.dispatch({
      type: "tts_start",
      timestamp: Date.now(),
      turnId,
      chunkId,
    });

    for (let i = 0; i < chunkCount; i++) {
      if (chunkDelay > 0) {
        await sleep(chunkDelay);
      }

      // Generate a minimal valid MP3 frame as mock audio data.
      // Real LiveKit integration would receive actual audio from the server.
      const mockAudio = generateMockAudioChunk(text, i);

      this.dispatch({
        type: "tts_audio_chunk",
        timestamp: Date.now(),
        turnId,
        chunkId,
        audioB64: mockAudio,
        mimeType: "audio/mpeg",
      });
    }

    this.dispatch({
      type: "tts_end",
      timestamp: Date.now(),
      turnId,
      chunkId,
    });

    // Emit turn_end
    this.dispatch({
      type: "turn_end",
      timestamp: Date.now(),
      turnId,
      role: "assistant",
    });
  }

  async sendAudio(_audio: ArrayBuffer): Promise<void> {
    this.assertConnected();
    // Mock mode: no-op. Real LiveKit would forward mic audio to the room.
  }

  async bargeIn(): Promise<void> {
    this.assertConnected();
    const turnId = `lk-turn-${this.turnCounter}`;
    this.dispatch({
      type: "barge_in_detected",
      timestamp: Date.now(),
      turnId,
    });
  }

  on(handler: EventHandler): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private dispatch(event: KithEvent): void {
    for (const h of this.handlers) {
      try {
        const out = h(event);
        if (out !== undefined) void out;
      } catch (err) {
        console.error("kith: livekit-runtime handler threw", err);
      }
    }
  }

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error("LiveKitRuntime is not connected");
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a deterministic mock audio chunk. Not real audio — just enough
 * bytes to prove the event pipeline works end-to-end.
 */
function generateMockAudioChunk(text: string, index: number): string {
  // Create a small buffer seeded from the text + index so chunks differ
  const seed = text.length + index;
  const bytes = new Uint8Array(64);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = (seed * 31 + i * 7) & 0xff;
  }
  // Base64 encode
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}
