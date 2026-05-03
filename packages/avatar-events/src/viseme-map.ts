/**
 * Phoneme-to-viseme mapping for VRM blend shapes.
 *
 * Maps IPA phoneme groups to VRM-compatible viseme names. The standard
 * VRM blend shapes are: aa, ih, ou, ee, oh, plus neutral (rest).
 *
 * Consumers use this to translate `viseme_frame` events into blend shape
 * weights on a VRM model:
 *
 *   voice.on(event => {
 *     if (event.type === "viseme_frame") {
 *       const blend = mapVisemeToBlendShape(event.viseme);
 *       vrm.expressionManager.setValue(blend.name, event.weight * blend.scale);
 *     }
 *   });
 */

export interface BlendShapeTarget {
  /** VRM expression name (e.g., "aa", "ih", "ou", "ee", "oh") */
  name: string;
  /** Suggested scale multiplier (0-1). Some visemes are naturally subtler. */
  scale: number;
}

/**
 * Standard viseme-to-VRM-blend-shape mapping.
 *
 * Viseme labels follow the Oculus/Meta standard used by most TTS providers
 * that emit viseme data (ElevenLabs, Azure, etc.).
 */
const VISEME_TO_BLEND: Record<string, BlendShapeTarget> = {
  // Silence / rest
  sil: { name: "neutral", scale: 0 },
  // Open vowels
  aa: { name: "aa", scale: 1.0 },
  ah: { name: "aa", scale: 0.9 },
  ax: { name: "aa", scale: 0.7 },
  // Front vowels
  ee: { name: "ee", scale: 1.0 },
  ih: { name: "ih", scale: 0.85 },
  // Rounded vowels
  oh: { name: "oh", scale: 1.0 },
  oo: { name: "ou", scale: 1.0 },
  ou: { name: "ou", scale: 0.9 },
  // Bilabials (lips together)
  pp: { name: "ou", scale: 0.3 },
  mb: { name: "ou", scale: 0.35 },
  // Labiodentals (teeth on lip)
  ff: { name: "ih", scale: 0.4 },
  // Alveolars (tongue to ridge)
  th: { name: "ih", scale: 0.3 },
  dd: { name: "ih", scale: 0.35 },
  nn: { name: "ih", scale: 0.3 },
  // Velars (back of mouth)
  kk: { name: "aa", scale: 0.3 },
  gg: { name: "aa", scale: 0.35 },
  // Sibilants
  ss: { name: "ee", scale: 0.3 },
  sh: { name: "ou", scale: 0.35 },
  ch: { name: "ee", scale: 0.35 },
  // Semivowels
  rr: { name: "oh", scale: 0.3 },
  ll: { name: "ih", scale: 0.35 },
};

/**
 * Map a viseme label (from a `viseme_frame` event) to a VRM blend shape.
 * Returns the neutral target for unknown visemes.
 */
export function mapVisemeToBlendShape(viseme: string): BlendShapeTarget {
  return VISEME_TO_BLEND[viseme.toLowerCase()] ?? { name: "neutral", scale: 0 };
}

/**
 * Get all supported viseme labels.
 */
export function supportedVisemes(): string[] {
  return Object.keys(VISEME_TO_BLEND);
}

/**
 * Get all VRM blend shape names used by the mapping.
 */
export function blendShapeNames(): string[] {
  return [...new Set(Object.values(VISEME_TO_BLEND).map((b) => b.name))];
}
