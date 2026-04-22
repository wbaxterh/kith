/**
 * Types for text-shaping hooks that run before text reaches the voice loop.
 *
 * Kith does not ship opinionated persona transformers. It ships the slot.
 * Consumers register `TextTransform` functions that mutate the text based on
 * whatever policy they want (persona modes, profanity masking, slang
 * normalization, injection of breath hints, etc.).
 */

export type PersonaMode = "neutral" | "hype" | "coach" | "calm";

export interface TextTransformContext {
  personaMode: PersonaMode;
}

export type TextTransform = (text: string, ctx: TextTransformContext) => string;

/**
 * Pronunciation overrides. Keys are matched case-insensitively as whole words;
 * values are the spoken replacement. Use this for specific words the TTS
 * provider mispronounces (e.g., `"kickflip": "kick flip"`).
 *
 * For expanding abbreviations to full words ("omg" → "oh my god") prefer
 * `SlangDict` — same shape, but applied earlier in the pipeline so its output
 * is itself subject to pronunciation overrides.
 */
export type PronunciationDict = Record<string, string>;

/**
 * Abbreviation expansion map. Structurally identical to `PronunciationDict`
 * but semantically and pipeline-ordering distinct: slang expands first (so
 * TTS speaks the full words), pronunciation corrects after.
 *
 * Keys are matched case-insensitively as whole words. The leading capital of
 * the input is preserved on the replacement (`"OMG"` → `"Oh my god"`).
 */
export type SlangDict = Record<string, string>;
