/**
 * @kithjs/elizaos — Kith voice plugin for ElizaOS.
 *
 * Drop-in replacement for @elizaos/plugin-elevenlabs. Adds:
 * - Sentence-aware chunking (no mid-thought pauses)
 * - Slang expansion (fr → for real, lol → [laughs])
 * - Pronunciation overrides
 * - Emoji → emotion events (stripped before TTS)
 * - ElevenLabs v3 laugh tags (real laughter)
 * - VoiceCharacter profiles
 * - Text transform pipeline
 *
 * Install:
 *   bun add @kithjs/elizaos
 *
 * Configure in your agent's .env:
 *   ELEVENLABS_XI_API_KEY=sk_...
 *   ELEVENLABS_VOICE_ID=kPzsL2i3teMYv0FxEYQ6
 *
 * Register in your agent's character.ts:
 *   import kithVoice from "@kithjs/elizaos";
 *   plugins: [kithVoice]
 */

import type { KithEvent } from "@kithjs/core";
import {
  DEFAULT_BOARD_SPORTS_SLANG,
  DEFAULT_ENGLISH_SLANG,
  DEFAULT_GENZ_SLANG,
  DEFAULT_LAUGH_TAGS,
  VoiceRouter,
  type VoiceCharacter,
  voiceCharacterToRuntimeConfig,
} from "@kithjs/voice-router";

import { ElevenLabsDirectAdapter } from "./direct-adapter.ts";
import { resolveConfig, type KithElizaConfig } from "./environment.ts";

/** Clean AI-generated text for natural TTS. */
function cleanForTTS(text: string): string {
  let t = text;
  t = t.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1"); // strip markdown
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");  // strip links
  t = t.replace(/([!?.]){2,}/g, "$1");              // collapse punctuation
  t = t.replace(/([a-z])\1{3,}/gi, "$1$1");         // collapse extended vowels
  t = t.replace(/:[a-z_]+:/g, "");                   // strip :emoji_codes:
  return t;
}

/**
 * Synthesize speech using Kith's full voice pipeline.
 *
 * This is the core function: text goes through VoiceRouter (chunking,
 * slang, pronunciation, emoji) and then through ElevenLabsDirectAdapter
 * (actual TTS synthesis). Returns collected audio events.
 */
export async function synthesizeWithKith(
  text: string,
  config: KithElizaConfig,
  character?: VoiceCharacter,
): Promise<{ audio: KithEvent[]; emotions: KithEvent[] }> {
  const adapter = new ElevenLabsDirectAdapter({
    apiKey: config.apiKey,
    voiceId: config.voiceId,
    modelId: config.modelId,
    stability: config.stability,
    similarityBoost: config.similarityBoost,
    style: config.style,
    speed: config.speed,
  });

  await adapter.connect({ sessionId: `elizaos-${Date.now()}` });

  const slang = config.enableSlang
    ? {
        ...DEFAULT_ENGLISH_SLANG,
        ...DEFAULT_GENZ_SLANG,
        ...DEFAULT_BOARD_SPORTS_SLANG,
        ...DEFAULT_LAUGH_TAGS,
        ...(character?.slang ?? {}),
      }
    : {};

  const voice = new VoiceRouter({
    runtime: adapter,
    character,
    slang,
    transforms: [cleanForTTS],
    emojiMap: config.enableEmoji ? undefined : null,
  });

  const audio: KithEvent[] = [];
  const emotions: KithEvent[] = [];

  voice.on((event) => {
    if (event.type === "tts_audio_chunk") {
      audio.push(event);
    } else if (event.type === "emotion_state") {
      emotions.push(event);
    }
  });

  await voice.speak(text);
  voice.destroy();
  await adapter.disconnect();

  return { audio, emotions };
}

/**
 * ElizaOS Plugin definition.
 *
 * Register in your agent:
 *   import kithVoice from "@kithjs/elizaos";
 *   plugins: [kithVoice]
 */
const kithVoicePlugin = {
  name: "@kithjs/elizaos",
  description:
    "Natural voice for ElizaOS agents — sentence-aware TTS, slang expansion, " +
    "pronunciation overrides, emoji-to-emotion, and multi-provider fallback " +
    "powered by Kith. Drop-in replacement for plugin-elevenlabs.",

  async init(_config: Record<string, string>, runtime: any) {
    const cfg = resolveConfig(runtime?.getSetting?.bind(runtime));
    if (!cfg.apiKey) {
      console.error("[kith/elizaos] No ElevenLabs API key — plugin disabled");
      return;
    }
    console.log(
      `[kith/elizaos] initialized — voice=${cfg.voiceId}, model=${cfg.modelId}, ` +
        `slang=${cfg.enableSlang}, emoji=${cfg.enableEmoji}`,
    );
  },

  services: [],

  actions: [
    {
      name: "KITH_SPEAK",
      similes: ["speak", "say", "voice", "tts"],
      description: "Synthesize speech from text using Kith voice pipeline",
      examples: [],
      validate: async () => true,
      handler: async (
        runtime: any,
        message: any,
        _state: any,
        _options: any,
        callback: any,
      ) => {
        const text = message?.content?.text;
        if (!text) return;

        const cfg = resolveConfig(runtime?.getSetting?.bind(runtime));
        const { audio } = await synthesizeWithKith(text, cfg);

        if (callback && audio.length > 0) {
          callback({
            text: `[Voice: ${audio.length} audio chunk(s) synthesized]`,
            audio: audio.map((a: any) => a.audioB64),
          });
        }
      },
    },
  ],

  providers: [
    {
      name: "kith-voice-status",
      description: "Current Kith voice configuration",
      get: async (runtime: any) => {
        const cfg = resolveConfig(runtime?.getSetting?.bind(runtime));
        return {
          text: `Kith voice: ${cfg.apiKey ? "configured" : "not configured"}, ` +
            `voice=${cfg.voiceId}, model=${cfg.modelId}`,
          values: {
            configured: !!cfg.apiKey,
            voiceId: cfg.voiceId,
            modelId: cfg.modelId,
            slang: cfg.enableSlang,
            emoji: cfg.enableEmoji,
          },
        };
      },
    },
  ],
};

export default kithVoicePlugin;

// Named exports for standalone use
export { ElevenLabsDirectAdapter, type DirectAdapterOptions } from "./direct-adapter.ts";
export { resolveConfig, type KithElizaConfig } from "./environment.ts";
export { VoiceRouter } from "@kithjs/voice-router";
