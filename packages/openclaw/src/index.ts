/**
 * @kithjs/openclaw — Kith voice plugin for OpenClaw.
 *
 * Registers Kith as a speech provider in OpenClaw's plugin system. When
 * installed, OpenClaw agents can use Kith's voice pipeline for TTS output:
 *
 *   - Sentence-aware chunking (no mid-thought pauses)
 *   - Slang expansion + pronunciation overrides
 *   - Emoji → emotion events for avatar rendering
 *   - Multi-provider TTS fallback (ElevenLabs, OpenAI, Cartesia)
 *   - VoiceCharacter profiles for per-agent voice personality
 *   - Real laughter via ElevenLabs v3 laugh tags
 *
 * Install:
 *   openclaw plugins install @kithjs/openclaw
 *
 * Configure in openclaw.yaml:
 *   plugins:
 *     entries:
 *       kith-voice:
 *         provider: elevenlabs
 *         voiceId: kPzsL2i3teMYv0FxEYQ6
 *         enableSlang: true
 *         enableEmoji: true
 */

import type { SlangDict, TextTransform } from "@kithjs/core";
import {
  DEFAULT_BOARD_SPORTS_SLANG,
  DEFAULT_ENGLISH_SLANG,
  DEFAULT_GENZ_SLANG,
  DEFAULT_LAUGH_TAGS,
  SentenceChunker,
  VoiceRouter,
  type VoiceCharacter,
  voiceCharacterToRuntimeConfig,
} from "@kithjs/voice-router";

export interface KithPluginConfig {
  provider?: string;
  voiceId?: string;
  modelId?: string;
  characterProfile?: string;
  enableSlang?: boolean;
  enableEmoji?: boolean;
  fallbackProviders?: string[];
  /** Custom slang entries to merge with defaults */
  customSlang?: SlangDict;
  /** Custom text transforms applied before TTS */
  customTransforms?: TextTransform[];
}

/**
 * Build the slang dictionary based on config.
 */
function buildSlangDict(
  config: KithPluginConfig,
  character?: VoiceCharacter,
): SlangDict {
  if (!config.enableSlang) return {};

  return {
    ...DEFAULT_ENGLISH_SLANG,
    ...DEFAULT_GENZ_SLANG,
    ...DEFAULT_BOARD_SPORTS_SLANG,
    ...DEFAULT_LAUGH_TAGS,
    ...(character?.slang ?? {}),
    ...(config.customSlang ?? {}),
  };
}

/**
 * Process text through Kith's voice pipeline.
 *
 * This is the core function that OpenClaw's speech provider calls. It:
 * 1. Strips emojis and emits emotion events
 * 2. Chunks text at sentence boundaries
 * 3. Expands slang and applies pronunciation
 * 4. Runs custom text transforms
 * 5. Returns processed chunks ready for TTS synthesis
 */
export function processTextForSpeech(
  text: string,
  config: KithPluginConfig,
  character?: VoiceCharacter,
): string[] {
  const slang = buildSlangDict(config, character);
  const chunker = new SentenceChunker();

  // Apply slang expansion
  let processed = text;
  for (const [abbr, expansion] of Object.entries(slang)) {
    const regex = new RegExp(`\\b${abbr}\\b`, "gi");
    processed = processed.replace(regex, expansion);
  }

  // Apply pronunciation overrides
  const pronunciation = character?.pronunciation ?? {};
  for (const [word, phonetic] of Object.entries(pronunciation)) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    processed = processed.replace(regex, phonetic);
  }

  // Apply custom transforms
  if (config.customTransforms) {
    for (const transform of config.customTransforms) {
      processed = transform(processed, { personaMode: character?.personaMode ?? "neutral" });
    }
  }

  // Strip emojis (TTS reads them aloud otherwise)
  processed = processed.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    "",
  );

  // Chunk at sentence boundaries
  const chunks = [...chunker.feed(processed), ...chunker.flush()];
  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Build the TTS pipeline configuration for the Pipecat sidecar.
 */
export function buildPipelineConfig(
  config: KithPluginConfig,
  character?: VoiceCharacter,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    pipeline: config.provider === "fallback" ? "fallback" : (config.provider ?? "elevenlabs"),
    voiceId: config.voiceId,
    modelId: config.modelId ?? "eleven_v3",
  };

  if (config.provider === "fallback" && config.fallbackProviders) {
    base.providers = config.fallbackProviders;
  }

  // Merge VoiceCharacter voice settings
  if (character) {
    Object.assign(base, voiceCharacterToRuntimeConfig(character));
  }

  return base;
}

/**
 * OpenClaw plugin entry point.
 *
 * This module is designed to work with OpenClaw's plugin SDK. When the SDK
 * types are available, the plugin registers as a speech provider. For
 * standalone use, import processTextForSpeech and buildPipelineConfig directly.
 */
export const kithVoicePlugin = {
  id: "kith-voice",
  name: "Kith Voice",
  version: "0.2.0",

  register(api: any) {
    const config: KithPluginConfig = api?.getConfig?.() ?? {};

    // Register as a speech provider if the API supports it
    if (api?.registerSpeechProvider) {
      api.registerSpeechProvider({
        id: "kith",
        name: "Kith Voice (Natural TTS)",

        async synthesize(text: string): Promise<string[]> {
          return processTextForSpeech(text, config);
        },

        getPipelineConfig() {
          return buildPipelineConfig(config);
        },
      });
    }

    // Register an output hook to process text before any TTS
    if (api?.registerHook) {
      api.registerHook("llm_output", {
        id: "kith-voice-processor",
        async handler(context: any) {
          if (!context?.text) return;
          const chunks = processTextForSpeech(context.text, config);
          if (context.setProcessedChunks) {
            context.setProcessedChunks(chunks);
          }
        },
      });
    }

    console.log("[kith] voice plugin registered for OpenClaw");
  },
};

export default kithVoicePlugin;

// Re-export core utilities for standalone use
export { SentenceChunker, VoiceRouter } from "@kithjs/voice-router";
export type { VoiceCharacter } from "@kithjs/voice-router";
