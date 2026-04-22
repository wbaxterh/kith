import type { PersonaMode, PronunciationDict, SlangDict } from "@kith/core";

import type { EmotionHint } from "./emoji-sentiment.ts";
import type { VoiceRouter } from "./router.ts";

/**
 * VoiceCharacter — a typed bundle of a character's *voice-layer* settings.
 *
 * Deliberately narrow. It covers the knobs that shape how a character sounds
 * (TTS params, slang, pronunciation, emoji sentiment, persona mode). It does
 * NOT define bio, lore, system prompts, tool configs, memory, or anything
 * else that belongs to the consumer's agent. For that, use whatever your
 * agent stack defines — Kith stays out of the way.
 *
 * Typical usage:
 *
 *   import profile from "./kaori-voice.json" with { type: "json" };
 *   import {
 *     DEFAULT_ENGLISH_SLANG,
 *     DEFAULT_GENZ_SLANG,
 *     DEFAULT_BOARD_SPORTS_SLANG,
 *     VoiceRouter,
 *     voiceCharacterToRuntimeConfig,
 *   } from "@kith/voice-router";
 *
 *   const runtime = new PipecatRuntime({
 *     pythonPath: …, cwd: …,
 *     config: {
 *       pipeline: "elevenlabs",
 *       apiKey: process.env.ELEVENLABS_API_KEY,
 *       ...voiceCharacterToRuntimeConfig(profile),
 *     },
 *   });
 *
 *   const voice = new VoiceRouter({
 *     runtime,
 *     character: profile,
 *     // Compose defaults with profile at the call site so you're explicit
 *     // about layering. Character's `slang` wins on collision.
 *     slang: { ...DEFAULT_ENGLISH_SLANG, ...DEFAULT_GENZ_SLANG, ...DEFAULT_BOARD_SPORTS_SLANG, ...profile.slang },
 *   });
 */
export interface VoiceCharacter {
  /**
   * TTS-side voice settings — voiceId, model, stability, etc. These are
   * forwarded to the runtime's pipeline config, not used by VoiceRouter
   * directly. Extract with `voiceCharacterToRuntimeConfig`.
   */
  voice?: {
    voiceId?: string;
    modelId?: string;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
    speed?: number;
    outputFormat?: string;
  };

  /** Slang / abbreviation map specific to this character. */
  slang?: SlangDict;

  /** Pronunciation overrides — names, loanwords, anything TTS mispronounces. */
  pronunciation?: PronunciationDict;

  /** Optional custom emoji → emotion map. Overrides the default for any
   * key it defines; unspecified emojis keep their default behavior. Use
   * `null` to disable emoji parsing entirely for this character. */
  emojiMap?: Record<string, EmotionHint> | null;

  /** Persona mode hint. Consumers decide what to do with it via transforms. */
  personaMode?: PersonaMode;
}

/**
 * Extract the runtime-side voice settings from a VoiceCharacter as a plain
 * object ready to spread into a `RuntimeConfig`'s pipeline config.
 *
 *   const runtime = new PipecatRuntime({
 *     config: { pipeline: "elevenlabs", apiKey, ...voiceCharacterToRuntimeConfig(profile) },
 *   });
 */
export function voiceCharacterToRuntimeConfig(character: VoiceCharacter): Record<string, unknown> {
  return { ...(character.voice ?? {}) };
}

/**
 * Apply a character profile to an existing VoiceRouter. Mutates the router's
 * slang / pronunciation / persona mode / emoji map. Use this when you want
 * to swap characters mid-session; at construction time prefer passing
 * `character` directly to the VoiceRouter constructor.
 *
 * Does NOT touch TTS-side voice settings — those are bound to the runtime
 * and require reconnecting. For a full character swap, tear down the
 * VoiceRouter + runtime and rebuild.
 */
export function applyVoiceCharacter(router: VoiceRouter, character: VoiceCharacter): void {
  if (character.slang !== undefined) router.setSlang(character.slang);
  if (character.pronunciation !== undefined) router.setPronunciation(character.pronunciation);
  if (character.personaMode !== undefined) router.setPersonaMode(character.personaMode);
}
