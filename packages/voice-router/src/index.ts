export { SentenceChunker, type SentenceChunkerOptions } from "./chunker.ts";
export {
  analyzeEmojis,
  DEFAULT_EMOJI_MAP,
  dominantHint,
  type EmojiAnalysis,
  type EmotionHint,
  type EmotionPolarity,
} from "./emoji-sentiment.ts";
export { applyPronunciation } from "./pronunciation.ts";
export { VoiceRouter, type VoiceRouterOptions } from "./router.ts";
export {
  DEFAULT_BOARD_SPORTS_SLANG,
  DEFAULT_ENGLISH_SLANG,
  DEFAULT_GENZ_SLANG,
} from "./slang-defaults.ts";
