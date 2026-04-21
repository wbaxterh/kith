/**
 * Wire-protocol types. Mirrors docs/protocol.md and the pydantic models
 * under `python/kith_runtime/envelope.py`.
 *
 * Field names are camelCase on the wire (same as the `KithEvent` union in
 * `@kith/core`), so sidecar messages can be forwarded to consumers with only
 * the envelope `v` key stripped.
 */

import type { KithEvent } from "@kith/core";

export const PROTOCOL_VERSION = 0;

type OpBase = { v: 0 };

export type HelloOp = OpBase & {
  op: "hello";
  sessionId: string;
  config: Record<string, unknown>;
};

export type SendTextOp = OpBase & {
  op: "sendText";
  text: string;
  turnId?: string;
};

export type SendAudioOp = OpBase & {
  op: "sendAudio";
  audioB64: string;
  sampleRate: number;
  mimeType?: string;
};

export type BargeInOp = OpBase & { op: "bargeIn" };
export type DisconnectOp = OpBase & { op: "disconnect" };

export type Op = HelloOp | SendTextOp | SendAudioOp | BargeInOp | DisconnectOp;

/** An event coming back from the sidecar. Matches KithEvent with a `v` prefix
 * and the `type` field renamed to `event` (Python convention). */
export type WireEvent =
  | { v: 0; event: "ready"; timestamp: number }
  | { v: 0; event: "turn_start"; timestamp: number; turnId: string; role: "user" | "assistant" }
  | { v: 0; event: "turn_end"; timestamp: number; turnId: string; role: "user" | "assistant" }
  | { v: 0; event: "tts_start"; timestamp: number; turnId: string; chunkId: string }
  | { v: 0; event: "tts_end"; timestamp: number; turnId: string; chunkId: string }
  | { v: 0; event: "stt_partial"; timestamp: number; turnId: string; text: string }
  | { v: 0; event: "stt_final"; timestamp: number; turnId: string; text: string }
  | {
      v: 0;
      event: "viseme_frame";
      timestamp: number;
      turnId: string;
      viseme: string;
      weight: number;
      offsetMs: number;
    }
  | { v: 0; event: "emotion_state"; timestamp: number; state: string; intensity: number }
  | { v: 0; event: "barge_in_detected"; timestamp: number; turnId: string }
  | { v: 0; event: "reconnect"; timestamp: number; attempt: number }
  | { v: 0; event: "error"; timestamp: number; message: string; retriable: boolean };

/**
 * Convert a wire event to a public `KithEvent`. The mapping is 1:1 — this
 * function exists so the `ready` event (which is sidecar-internal, not part
 * of the public bus) can be filtered out cleanly by the caller.
 */
export function toKithEvent(wire: WireEvent): KithEvent | null {
  if (wire.event === "ready") return null;
  const { v: _v, event, ...rest } = wire;
  return { type: event, ...rest } as KithEvent;
}
