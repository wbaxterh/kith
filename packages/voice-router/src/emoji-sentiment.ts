/**
 * Emoji → emotion translation.
 *
 * Rather than reading emojis aloud ("laughing crying face") or silently
 * dropping them, Kith treats them as emotional signal. `analyzeEmojis`
 * strips them from the text that reaches TTS and produces a list of
 * `EmotionHint`s that the VoiceRouter emits as `emotion_state` events —
 * giving the avatar, UI, and any downstream observers a clean channel
 * for the sentiment the user's text is carrying.
 *
 * The built-in map covers common emotive emojis. Consumers override via
 * `VoiceRouterOptions.emojiMap` — typically `{ ...DEFAULT_EMOJI_MAP, ... }`
 * to extend rather than replace.
 */

export interface EmotionHint {
  state: string;
  /** 0..1 — how strongly this emoji asserts the state. */
  intensity: number;
}

/**
 * Default emoji → emotion mapping. Curated rather than exhaustive — there
 * are thousands of emojis; these are the ones companion apps actually see.
 */
export const DEFAULT_EMOJI_MAP: Record<string, EmotionHint> = {
  // happy / positive
  "😊": { state: "happy", intensity: 0.6 },
  "🙂": { state: "happy", intensity: 0.4 },
  "😄": { state: "happy", intensity: 0.8 },
  "😃": { state: "happy", intensity: 0.7 },
  "😁": { state: "happy", intensity: 0.7 },
  "😀": { state: "happy", intensity: 0.7 },

  // excited / hype
  "🎉": { state: "excited", intensity: 0.9 },
  "🔥": { state: "excited", intensity: 0.8 },
  "✨": { state: "excited", intensity: 0.5 },
  "⚡": { state: "excited", intensity: 0.7 },
  "🚀": { state: "excited", intensity: 0.8 },
  "💯": { state: "excited", intensity: 0.8 },

  // amused / laughing
  "😂": { state: "amused", intensity: 0.9 },
  "🤣": { state: "amused", intensity: 1.0 },
  "😆": { state: "amused", intensity: 0.8 },
  "😹": { state: "amused", intensity: 0.8 },
  "💀": { state: "amused", intensity: 0.9 }, // Gen Z: "I'm dead" = laughing

  // affectionate
  "🥰": { state: "affectionate", intensity: 0.8 },
  "😍": { state: "affectionate", intensity: 0.8 },
  "💖": { state: "affectionate", intensity: 0.8 },
  "❤️": { state: "affectionate", intensity: 0.7 },
  "♥️": { state: "affectionate", intensity: 0.6 },

  // sad
  "😢": { state: "sad", intensity: 0.6 },
  "😭": { state: "sad", intensity: 0.9 },
  "😞": { state: "sad", intensity: 0.6 },
  "😔": { state: "sad", intensity: 0.5 },
  "💔": { state: "sad", intensity: 0.7 },

  // alarmed / worried
  "😱": { state: "alarmed", intensity: 0.9 },
  "😨": { state: "alarmed", intensity: 0.7 },
  "😰": { state: "worried", intensity: 0.7 },
  "😬": { state: "awkward", intensity: 0.6 },

  // frustrated / angry
  "😤": { state: "frustrated", intensity: 0.7 },
  "😡": { state: "angry", intensity: 0.8 },
  "🤬": { state: "angry", intensity: 0.9 },

  // thoughtful
  "🤔": { state: "thoughtful", intensity: 0.5 },
  "🧐": { state: "thoughtful", intensity: 0.5 },

  // surprised
  "😮": { state: "surprised", intensity: 0.7 },
  "😲": { state: "surprised", intensity: 0.8 },
  "🤯": { state: "surprised", intensity: 0.9 },

  // calm / chill
  "😌": { state: "calm", intensity: 0.5 },
  "😴": { state: "calm", intensity: 0.3 },
  "🙃": { state: "wry", intensity: 0.5 },

  // approval / disapproval
  "👍": { state: "approving", intensity: 0.5 },
  "👎": { state: "disapproving", intensity: 0.5 },
  "🙌": { state: "celebrating", intensity: 0.7 },
};

// Matches Unicode Extended_Pictographic (covers ~all emoji pictographs).
// Includes trailing variation selectors (FE0F) and ZWJ sequences by
// matching runs of pictographs + ZWJ + variation selectors.
const EMOJI_REGEX = /\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic})*\uFE0F?/gu;

export interface EmojiAnalysis {
  /** Input text with emojis removed and consecutive whitespace collapsed. */
  strippedText: string;
  /** One hint per recognized emoji in the order they appeared. */
  hints: EmotionHint[];
}

export function analyzeEmojis(
  text: string,
  map: Record<string, EmotionHint> = DEFAULT_EMOJI_MAP,
): EmojiAnalysis {
  const hints: EmotionHint[] = [];
  let stripped = "";
  let lastIdx = 0;

  for (const match of text.matchAll(EMOJI_REGEX)) {
    const idx = match.index;
    if (idx === undefined) continue;
    stripped += text.slice(lastIdx, idx);
    lastIdx = idx + match[0].length;
    const hint = map[match[0]];
    if (hint !== undefined) hints.push(hint);
  }
  stripped += text.slice(lastIdx);

  // Deliberately do NOT trim or collapse whitespace here — callers may be
  // feeding a single token slice from an LLM stream, where leading/trailing
  // whitespace carries the word boundary. The chunker trims each emitted
  // sentence on its own, so any extra internal whitespace from a removed
  // emoji is a non-issue by the time audio is synthesized.
  return { strippedText: stripped, hints };
}

/** Collapse a list of hints into a dominant emotion, or null if empty. */
export function dominantHint(hints: EmotionHint[]): EmotionHint | null {
  if (hints.length === 0) return null;
  let best = hints[0] as EmotionHint;
  for (const h of hints) {
    if (h.intensity > best.intensity) best = h;
  }
  return best;
}
