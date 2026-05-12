/**
 * Environment variable validation for the Kith ElizaOS plugin.
 */

export interface KithElizaConfig {
  apiKey: string;
  voiceId: string;
  modelId: string;
  enableSlang: boolean;
  enableEmoji: boolean;
  characterFile: string | null;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
}

/**
 * Extract config from ElizaOS runtime settings or environment variables.
 * Follows ElizaOS naming conventions (ELEVENLABS_XI_API_KEY).
 */
export function resolveConfig(getSetting?: (key: string) => string | undefined): KithElizaConfig {
  const get = (key: string): string | undefined =>
    getSetting?.(key) ?? process.env[key];

  const apiKey =
    get("ELEVENLABS_XI_API_KEY") ??
    get("ELEVENLABS_API_KEY") ??
    "";

  const voiceId =
    get("ELEVENLABS_VOICE_ID") ??
    get("KITH_VOICE_ID") ??
    "";

  const modelId =
    get("ELEVENLABS_MODEL_ID") ??
    get("KITH_MODEL_ID") ??
    "eleven_v3";

  if (!apiKey) {
    console.warn("[kith/elizaos] ELEVENLABS_XI_API_KEY not set — TTS will fail");
  }

  return {
    apiKey,
    voiceId,
    modelId,
    enableSlang: get("KITH_ENABLE_SLANG") !== "false",
    enableEmoji: get("KITH_ENABLE_EMOJI") !== "false",
    characterFile: get("KITH_CHARACTER_FILE") ?? null,
    stability: get("ELEVENLABS_VOICE_STABILITY")
      ? Number(get("ELEVENLABS_VOICE_STABILITY"))
      : undefined,
    similarityBoost: get("ELEVENLABS_VOICE_SIMILARITY_BOOST")
      ? Number(get("ELEVENLABS_VOICE_SIMILARITY_BOOST"))
      : undefined,
    style: get("KITH_VOICE_STYLE") ? Number(get("KITH_VOICE_STYLE")) : undefined,
    speed: get("KITH_VOICE_SPEED") ? Number(get("KITH_VOICE_SPEED")) : undefined,
  };
}
