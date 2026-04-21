/**
 * Primitive types shared by Kith adapters.
 *
 * Deliberately minimal for v0.1. Extend only when an adapter concretely needs it.
 */

export type TurnId = string;
export type ChunkId = string;
export type SessionId = string;

/**
 * A single conversational turn. The minimum information Kith needs to correlate
 * inbound user speech with outbound agent speech across adapters.
 */
export interface TurnRecord {
  turnId: TurnId;
  sessionId: SessionId;
  role: "user" | "assistant";
  text: string;
  startedAt: number;
  endedAt?: number;
}

/**
 * Runtime connection configuration. Shape is intentionally open — adapters
 * declare their own extended types via module augmentation. `@kith/core`
 * only mandates the session identifier.
 */
export interface RuntimeConfig {
  sessionId: SessionId;
}

/**
 * Voice synthesis knobs that every provider should honor when routing through
 * `@kith/voice-router`. Provider-specific knobs live on adapter-level types.
 */
export interface VoiceOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  speed?: number;
  seed?: number;
}

export interface VoiceDescriptor {
  id: string;
  name: string;
  provider: string;
  previewUrl?: string;
}
