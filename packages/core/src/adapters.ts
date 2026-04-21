import type { EventHandler, Unsubscribe } from "./events.ts";
import type { RuntimeConfig, TurnRecord, VoiceDescriptor, VoiceOptions } from "./types.ts";

/**
 * RuntimeAdapter — owns the realtime voice loop.
 *
 * Primary implementation: `@kith/runtime-pipecat` (spawns a Python sidecar).
 * Secondary: `@kith/runtime-livekit` (v0.1 stub).
 *
 * The adapter is responsible for connection lifecycle, full-duplex I/O, and
 * emitting normalized events. It is NOT responsible for memory, RAG, or
 * persona — those belong to the consumer's agent.
 */
export interface RuntimeAdapter {
  connect(config: RuntimeConfig): Promise<void>;
  disconnect(): Promise<void>;

  /** Send assistant text to be spoken. Chunking/pacing is the adapter's job. */
  sendText(text: string): Promise<void>;

  /** Push an audio frame from the user's microphone. */
  sendAudio(audio: ArrayBuffer): Promise<void>;

  /** Stop any in-flight TTS immediately. Idempotent. */
  bargeIn(): Promise<void>;

  /** Subscribe to normalized events. Returns an unsubscribe function. */
  on(handler: EventHandler): Unsubscribe;
}

/**
 * VoiceAdapter — TTS provider routing.
 *
 * Consumers normally interact with `@kith/voice-router`, which composes one or
 * more `VoiceAdapter`s with pronunciation, chunking, and fallback logic. Direct
 * use of a single `VoiceAdapter` is supported for simple setups.
 */
export interface VoiceAdapter {
  synthesize(
    text: string,
    options?: VoiceOptions,
  ): Promise<ArrayBuffer | ReadableStream<Uint8Array>>;
  listVoices(): Promise<VoiceDescriptor[]>;
}

/**
 * MemoryAdapter — pass-through context fetch/save.
 *
 * Kith does not own memory. This adapter exists so a consumer can forward
 * turn records to their own vector store / database without coupling their
 * storage choice to Kith internals.
 *
 * v0.1 is a pass-through interface. We do NOT provide a default in-memory
 * implementation, because doing so would invite the wrong mental model
 * ("Kith can be my memory store").
 */
export interface MemoryAdapter {
  /** Return context messages relevant to the given turn, newest last. */
  fetch(turnId: string): Promise<string[]>;

  /** Persist a completed turn. */
  save(turn: TurnRecord): Promise<void>;
}

/**
 * ExpressionAdapter — emits avatar/expression frames.
 *
 * Scope is deliberately narrow for v0.1: this adapter only emits events.
 * Consumers render them. VRM loading, skeletal animation, and phoneme→viseme
 * mapping logic all live in the consumer (or in `@kith/avatar-events`'s helper
 * utilities in a future release).
 */
export interface ExpressionAdapter {
  subscribe(handler: (event: ExpressionSubscriptionEvent) => void): Unsubscribe;
}

/**
 * The subset of KithEvent shapes relevant to expression/avatar rendering.
 * Kept as a distinct union so ExpressionAdapter implementations aren't forced
 * to pattern-match the entire event bus.
 */
export type ExpressionSubscriptionEvent =
  | { type: "viseme_frame"; turnId: string; viseme: string; weight: number; offsetMs: number }
  | { type: "emotion_state"; state: string; intensity: number }
  | { type: "turn_start"; turnId: string; role: "user" | "assistant" }
  | { type: "turn_end"; turnId: string; role: "user" | "assistant" };

/**
 * ObservabilityAdapter — traces, guards, and reliability metrics.
 *
 * v0.1 gives us enough to diagnose the most common production failures
 * (duplicate send races, silent reconnect loops, delayed TTS arrivals).
 */
export interface ObservabilityAdapter {
  /**
   * Open a span. Caller must `end()` it to complete. Attrs are advisory and
   * may be dropped by minimal exporters.
   */
  trace(name: string, attrs?: Record<string, unknown>): Span;

  /**
   * Duplicate-send guard. Returns `true` if `key` has been seen within the
   * adapter's sliding window (consumer should skip the send). Returns `false`
   * on first sight and records the key.
   */
  guardDupSend(key: string): boolean;

  /** Record a reconnect attempt (e.g., WebSocket lost and retried). */
  recordReconnect(attempt: number): void;
}

export interface Span {
  setAttribute(key: string, value: unknown): void;
  end(): void;
}
