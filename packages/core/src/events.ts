import type { ChunkId, TurnId } from "./types.ts";

/**
 * The normalized event bus.
 *
 * This is the public contract consumers subscribe to. Adapters emit these;
 * everything else is an implementation detail. Adding an event type here is
 * cheaper than adding a method to an adapter — events scale with features,
 * methods scale with integrations. When in doubt, add an event.
 *
 * v0.1 keeps the taxonomy deliberately small. Post-demo iteration is expected.
 */
export type KithEvent =
  | TurnStartEvent
  | TurnEndEvent
  | TtsStartEvent
  | TtsAudioChunkEvent
  | TtsEndEvent
  | SttPartialEvent
  | SttFinalEvent
  | VisemeFrameEvent
  | EmotionStateEvent
  | BargeInDetectedEvent
  | ReconnectEvent
  | ErrorEvent;

interface EventBase {
  timestamp: number;
}

export interface TurnStartEvent extends EventBase {
  type: "turn_start";
  turnId: TurnId;
  role: "user" | "assistant";
}

export interface TurnEndEvent extends EventBase {
  type: "turn_end";
  turnId: TurnId;
  role: "user" | "assistant";
}

export interface TtsStartEvent extends EventBase {
  type: "tts_start";
  turnId: TurnId;
  chunkId: ChunkId;
}

/**
 * One slice of synthesized audio for a given chunk. Multiple `tts_audio_chunk`
 * events may arrive between a `tts_start` and its matching `tts_end` when the
 * upstream TTS service streams audio. `audioB64` is the raw audio payload
 * base64-encoded; `mimeType` tells the consumer how to decode (e.g.,
 * `audio/mpeg`, `audio/wav`, `audio/l16`).
 */
export interface TtsAudioChunkEvent extends EventBase {
  type: "tts_audio_chunk";
  turnId: TurnId;
  chunkId: ChunkId;
  audioB64: string;
  mimeType: string;
}

export interface TtsEndEvent extends EventBase {
  type: "tts_end";
  turnId: TurnId;
  chunkId: ChunkId;
}

export interface SttPartialEvent extends EventBase {
  type: "stt_partial";
  turnId: TurnId;
  text: string;
}

export interface SttFinalEvent extends EventBase {
  type: "stt_final";
  turnId: TurnId;
  text: string;
}

/** A single viseme frame — consumer decides how to render it. */
export interface VisemeFrameEvent extends EventBase {
  type: "viseme_frame";
  turnId: TurnId;
  viseme: string; // e.g. "aa", "ee", "mm" — phoneme group label
  weight: number; // 0..1 blend weight
  /** Offset in ms from the start of the associated TTS chunk. */
  offsetMs: number;
}

/** Emotional state hint for the consumer's renderer. */
export interface EmotionStateEvent extends EventBase {
  type: "emotion_state";
  state: string; // e.g. "neutral", "excited", "calm"
  intensity: number; // 0..1
}

export interface BargeInDetectedEvent extends EventBase {
  type: "barge_in_detected";
  turnId: TurnId;
}

export interface ReconnectEvent extends EventBase {
  type: "reconnect";
  attempt: number;
}

export interface ErrorEvent extends EventBase {
  type: "error";
  message: string;
  retriable: boolean;
  cause?: unknown;
}

/** Subscriber callback. Return value is ignored; throwing is logged, not thrown back. */
export type EventHandler = (event: KithEvent) => void | Promise<void>;

/** Unsubscribe function returned from `on()`. */
export type Unsubscribe = () => void;
