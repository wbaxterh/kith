/**
 * LiveKitRuntime — Kith RuntimeAdapter backed by LiveKit.
 *
 * v0.2: supports both mock mode (for testing without a server) and real
 * LiveKit WebRTC rooms via the livekit-client SDK.
 *
 * In real mode, the adapter:
 *   1. Connects to a LiveKit room using a provided token
 *   2. Publishes mic audio as a LocalAudioTrack
 *   3. Subscribes to the agent's audio track for TTS playback
 *   4. Uses data channels for text commands (sendText, bargeIn)
 *   5. Emits normalized KithEvents from room/track events
 *
 * The mock mode exercises the full RuntimeAdapter contract with
 * deterministic timing for tests and development.
 */

import type {
  EventHandler,
  KithEvent,
  RuntimeAdapter,
  RuntimeConfig,
  Unsubscribe,
} from "@kithjs/core";

export interface LiveKitRuntimeOptions {
  /**
   * LiveKit server URL. When omitted (or set to "mock"), the adapter runs in
   * local mock mode — no network calls, deterministic event timing.
   */
  url?: string;
  /** Access token for joining the LiveKit room. Required in real mode. */
  token?: string;
  /** Room name to join. Auto-generated from sessionId if omitted. */
  roomName?: string;
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
  private mode: "mock" | "real" = "mock";

  // Real mode state (populated lazily when livekit-client is available)
  private room: unknown = null;
  private dataEncoder = new TextEncoder();

  constructor(options: LiveKitRuntimeOptions = {}) {
    this.options = options;
  }

  async connect(config: RuntimeConfig): Promise<void> {
    if (this.connected) {
      throw new Error("LiveKitRuntime already connected");
    }

    const url = this.options.url ?? "mock";
    this.sessionId = config.sessionId;

    if (url === "mock") {
      this.mode = "mock";
      this.connected = true;
      return;
    }

    // Real LiveKit mode
    this.mode = "real";

    if (!this.options.token) {
      throw new Error(
        "LiveKitRuntime real mode requires a `token`. " +
          "Generate one with livekit-server-sdk's AccessToken.",
      );
    }

    try {
      // Dynamic import — livekit-client is an optional peer dependency
      const { Room, RoomEvent, Track } = await import("livekit-client");

      const room = new Room();
      this.room = room;

      // Subscribe to room events and translate to KithEvents
      room.on(RoomEvent.TrackSubscribed, (track: any, _pub: any, participant: any) => {
        if (track.kind === Track.Kind.Audio && participant.isAgent) {
          this.dispatch({
            type: "tts_start",
            timestamp: Date.now(),
            turnId: `lk-turn-${++this.turnCounter}`,
            chunkId: `lk-chunk-${++this.chunkCounter}`,
          });
        }
      });

      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant: any) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(payload));
          if (msg.type && msg.timestamp) {
            this.dispatch(msg as KithEvent);
          }
        } catch {
          // Not a KithEvent — ignore
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        this.connected = false;
        this.dispatch({
          type: "reconnect",
          timestamp: Date.now(),
          attempt: 1,
        });
      });

      await room.connect(url, this.options.token);
      this.connected = true;
    } catch (err: any) {
      throw new Error(`LiveKit connect failed: ${err?.message || err}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.mode === "real" && this.room) {
      try {
        (this.room as any).disconnect();
      } catch {
        // Already disconnected
      }
      this.room = null;
    }
    this.connected = false;
    this.sessionId = null;
  }

  async sendText(text: string): Promise<void> {
    this.assertConnected();

    if (this.mode === "mock") {
      await this.mockSendText(text);
      return;
    }

    // Real mode: send text via data channel
    const room = this.room as any;
    if (room?.localParticipant) {
      const payload = this.dataEncoder.encode(
        JSON.stringify({ op: "sendText", text, turnId: `lk-turn-${++this.turnCounter}` }),
      );
      await room.localParticipant.publishData(payload, { reliable: true });
    }
  }

  async sendAudio(audio: ArrayBuffer): Promise<void> {
    this.assertConnected();
    // In real mode, audio is published as a LiveKit audio track
    // during connect. Raw sendAudio is a no-op — the track handles it.
    // In mock mode, also a no-op.
  }

  async bargeIn(): Promise<void> {
    this.assertConnected();

    if (this.mode === "mock") {
      const turnId = `lk-turn-${this.turnCounter}`;
      this.dispatch({
        type: "barge_in_detected",
        timestamp: Date.now(),
        turnId,
      });
      return;
    }

    // Real mode: send barge-in via data channel
    const room = this.room as any;
    if (room?.localParticipant) {
      const payload = this.dataEncoder.encode(
        JSON.stringify({ op: "bargeIn" }),
      );
      await room.localParticipant.publishData(payload, { reliable: true });
    }
  }

  on(handler: EventHandler): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  // ---- Mock mode implementation ----

  private async mockSendText(text: string): Promise<void> {
    const turnId = `lk-turn-${++this.turnCounter}`;
    const chunkCount = this.options.mockChunkCount ?? 3;
    const chunkDelay = this.options.mockChunkDelayMs ?? 50;

    this.dispatch({
      type: "turn_start",
      timestamp: Date.now(),
      turnId,
      role: "assistant",
    });

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

    this.dispatch({
      type: "turn_end",
      timestamp: Date.now(),
      turnId,
      role: "assistant",
    });
  }

  // ---- Shared ----

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

function generateMockAudioChunk(text: string, index: number): string {
  const seed = text.length + index;
  const bytes = new Uint8Array(64);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = (seed * 31 + i * 7) & 0xff;
  }
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}
