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
 * values are the spoken replacement. Use this for slang / jargon the TTS
 * provider mispronounces (e.g., `"kickflip": "kick flip"`).
 */
export type PronunciationDict = Record<string, string>;
