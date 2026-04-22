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

export type EmotionPolarity = "positive" | "negative" | "neutral";

export interface EmotionHint {
  state: string;
  /** 0..1 — how strongly this emoji asserts the state. */
  intensity: number;
  polarity: EmotionPolarity;
}

/**
 * Default emoji → emotion mapping. Curated rather than exhaustive — there
 * are thousands of emojis; these are the ones companion apps actually see.
 */
export const DEFAULT_EMOJI_MAP: Record<string, EmotionHint> = {
  // happy / positive
  "😊": { state: "happy", intensity: 0.6, polarity: "positive" },
  "🙂": { state: "happy", intensity: 0.4, polarity: "positive" },
  "😄": { state: "happy", intensity: 0.8, polarity: "positive" },
  "😃": { state: "happy", intensity: 0.7, polarity: "positive" },
  "😁": { state: "happy", intensity: 0.7, polarity: "positive" },
  "😀": { state: "happy", intensity: 0.7, polarity: "positive" },

  // excited / hype
  "🎉": { state: "excited", intensity: 0.9, polarity: "positive" },
  "🔥": { state: "excited", intensity: 0.8, polarity: "positive" },
  "✨": { state: "excited", intensity: 0.5, polarity: "positive" },
  "⚡": { state: "excited", intensity: 0.7, polarity: "positive" },
  "🚀": { state: "excited", intensity: 0.8, polarity: "positive" },
  "💯": { state: "excited", intensity: 0.8, polarity: "positive" },

  // amused / laughing (often co-emoted with crying — "I'm dying of laughter")
  "😂": { state: "amused", intensity: 0.9, polarity: "positive" },
  "🤣": { state: "amused", intensity: 1.0, polarity: "positive" },
  "😆": { state: "amused", intensity: 0.8, polarity: "positive" },
  "😹": { state: "amused", intensity: 0.8, polarity: "positive" },
  // 💀 as Gen Z "I'm dead" (laughing) is positive, despite the icon. A pure
  // "end of times" reading would be neutral; we bet on the common meaning.
  "💀": { state: "amused", intensity: 0.9, polarity: "positive" },

  // affectionate
  "🥰": { state: "affectionate", intensity: 0.8, polarity: "positive" },
  "😍": { state: "affectionate", intensity: 0.8, polarity: "positive" },
  "💖": { state: "affectionate", intensity: 0.8, polarity: "positive" },
  "💕": { state: "affectionate", intensity: 0.7, polarity: "positive" },
  "❤️": { state: "affectionate", intensity: 0.7, polarity: "positive" },
  "♥️": { state: "affectionate", intensity: 0.6, polarity: "positive" },

  // sad (intentionally also covers the ambiguous 😭 — it reads "crying" but
  // Gen Z uses it as hyperbolic excitement. Aggregation settles the tie.)
  "😢": { state: "sad", intensity: 0.6, polarity: "negative" },
  "😭": { state: "sad", intensity: 0.9, polarity: "negative" },
  "😞": { state: "sad", intensity: 0.6, polarity: "negative" },
  "😔": { state: "sad", intensity: 0.5, polarity: "negative" },
  "💔": { state: "sad", intensity: 0.7, polarity: "negative" },

  // alarmed / worried
  "😱": { state: "alarmed", intensity: 0.9, polarity: "negative" },
  "😨": { state: "alarmed", intensity: 0.7, polarity: "negative" },
  "😰": { state: "worried", intensity: 0.7, polarity: "negative" },
  "😬": { state: "awkward", intensity: 0.6, polarity: "negative" },

  // frustrated / angry
  "😤": { state: "frustrated", intensity: 0.7, polarity: "negative" },
  "😡": { state: "angry", intensity: 0.8, polarity: "negative" },
  "🤬": { state: "angry", intensity: 0.9, polarity: "negative" },

  // thoughtful
  "🤔": { state: "thoughtful", intensity: 0.5, polarity: "neutral" },
  "🧐": { state: "thoughtful", intensity: 0.5, polarity: "neutral" },

  // surprised — polarity-neutral, context decides
  "😮": { state: "surprised", intensity: 0.7, polarity: "neutral" },
  "😲": { state: "surprised", intensity: 0.8, polarity: "neutral" },
  "🤯": { state: "surprised", intensity: 0.9, polarity: "neutral" },

  // calm / chill
  "😌": { state: "calm", intensity: 0.5, polarity: "positive" },
  "😴": { state: "calm", intensity: 0.3, polarity: "neutral" },
  "🙃": { state: "wry", intensity: 0.5, polarity: "neutral" },

  // approval / disapproval
  "👍": { state: "approving", intensity: 0.5, polarity: "positive" },
  "👎": { state: "disapproving", intensity: 0.5, polarity: "negative" },
  "🙌": { state: "celebrating", intensity: 0.7, polarity: "positive" },
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

/**
 * Collapse a list of hints into a single dominant emotion, or null if empty.
 *
 * Strategy: sum intensity per polarity, pick the polarity with the highest
 * total, then within it return the hint with the highest single intensity.
 * This prevents one strong negative emoji from overriding a string of
 * positive ones (e.g. "😭💕🔥" reads as positive/excited, not sad — the
 * 😭 there is being used as hyperbolic Gen Z excitement).
 *
 * Neutrals count toward their own bucket and only win when no valenced
 * emojis are present. Ties on polarity-total go to the polarity whose
 * strongest hint is strongest (highest single intensity). A final tie
 * falls back to first-seen — same deterministic order the hints arrived.
 */
export function dominantHint(hints: EmotionHint[]): EmotionHint | null {
  if (hints.length === 0) return null;

  const totals = { positive: 0, negative: 0, neutral: 0 };
  const strongest = {
    positive: null as EmotionHint | null,
    negative: null as EmotionHint | null,
    neutral: null as EmotionHint | null,
  };

  for (const h of hints) {
    totals[h.polarity] += h.intensity;
    const current = strongest[h.polarity];
    if (current === null || h.intensity > current.intensity) {
      strongest[h.polarity] = h;
    }
  }

  const order: EmotionPolarity[] = ["positive", "negative", "neutral"];
  let winner: EmotionPolarity = order[0] as EmotionPolarity;
  for (const p of order) {
    if (totals[p] > totals[winner]) winner = p;
    else if (
      totals[p] === totals[winner] &&
      (strongest[p]?.intensity ?? 0) > (strongest[winner]?.intensity ?? 0)
    ) {
      winner = p;
    }
  }

  return strongest[winner];
}
