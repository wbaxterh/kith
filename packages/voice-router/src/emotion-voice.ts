/**
 * Emotion-aware voice modulation.
 *
 * Maps detected emotion states to TTS voice parameter adjustments.
 * When emojis trigger an emotion_state event, these adjustments modify
 * the voice synthesis to match — excited text gets higher energy,
 * sad text gets softer delivery.
 *
 * Usage with VoiceRouter:
 *   const voice = new VoiceRouter({
 *     runtime,
 *     transforms: [createEmotionVoiceTransform(runtime)],
 *   });
 *
 * Or standalone:
 *   const params = getEmotionVoiceParams("excited", 0.8);
 *   // → { stability: -0.15, style: 0.2, speed: 0.05 }
 */

import type { RuntimeAdapter } from "@kithjs/core";

/**
 * Voice parameter adjustments for each emotion.
 * Values are DELTAS applied to the base voice settings.
 * Positive = increase, negative = decrease.
 */
export interface VoiceParamDelta {
  /** Delta to stability (lower = more expressive) */
  stability: number;
  /** Delta to style exaggeration */
  style: number;
  /** Delta to speed */
  speed: number;
  /** Delta to similarity boost */
  similarityBoost: number;
}

const EMOTION_DELTAS: Record<string, VoiceParamDelta> = {
  excited: {
    stability: -0.15,     // more expressive
    style: 0.2,           // more exaggerated
    speed: 0.05,          // slightly faster
    similarityBoost: 0,
  },
  happy: {
    stability: -0.08,
    style: 0.1,
    speed: 0.03,
    similarityBoost: 0,
  },
  calm: {
    stability: 0.15,      // more stable/steady
    style: -0.1,          // less exaggerated
    speed: -0.05,         // slightly slower
    similarityBoost: 0.05,
  },
  sad: {
    stability: 0.1,
    style: -0.15,         // less style
    speed: -0.08,         // slower
    similarityBoost: 0,
  },
  angry: {
    stability: -0.2,      // very expressive
    style: 0.25,          // very exaggerated
    speed: 0.03,
    similarityBoost: -0.05,
  },
  surprised: {
    stability: -0.12,
    style: 0.15,
    speed: 0.02,
    similarityBoost: 0,
  },
  neutral: {
    stability: 0,
    style: 0,
    speed: 0,
    similarityBoost: 0,
  },
};

/**
 * Get voice parameter deltas for an emotion at a given intensity.
 * Returns deltas scaled by intensity (0-1).
 */
export function getEmotionVoiceParams(
  emotion: string,
  intensity: number,
): VoiceParamDelta {
  const base = EMOTION_DELTAS[emotion] ?? EMOTION_DELTAS.neutral;
  const scale = Math.max(0, Math.min(1, intensity));
  return {
    stability: base.stability * scale,
    style: base.style * scale,
    speed: base.speed * scale,
    similarityBoost: base.similarityBoost * scale,
  };
}

/**
 * Apply emotion deltas to base voice settings, clamping to valid ranges.
 */
export function applyEmotionToVoiceSettings(
  base: { stability?: number; style?: number; speed?: number; similarityBoost?: number },
  emotion: string,
  intensity: number,
): { stability: number; style: number; speed: number; similarityBoost: number } {
  const delta = getEmotionVoiceParams(emotion, intensity);
  return {
    stability: clamp((base.stability ?? 0.5) + delta.stability, 0, 1),
    style: clamp((base.style ?? 0.4) + delta.style, 0, 1),
    speed: clamp((base.speed ?? 1.0) + delta.speed, 0.5, 2.0),
    similarityBoost: clamp((base.similarityBoost ?? 0.85) + delta.similarityBoost, 0, 1),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get all supported emotion names.
 */
export function supportedEmotions(): string[] {
  return Object.keys(EMOTION_DELTAS);
}
