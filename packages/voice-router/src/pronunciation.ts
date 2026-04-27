import type { PronunciationDict } from "@kithjs/core";

/**
 * Apply a pronunciation dictionary to a piece of text, matching whole words
 * case-insensitively while preserving the original casing pattern of each hit
 * (leading-capital input → leading-capital replacement).
 */
export function applyPronunciation(text: string, dict: PronunciationDict): string {
  if (Object.keys(dict).length === 0) return text;

  // Build one regex per dict key, escaping regex metacharacters.
  const entries = Object.entries(dict).map(([key, value]) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { pattern: new RegExp(`\\b${escaped}\\b`, "gi"), value };
  });

  let result = text;
  for (const { pattern, value } of entries) {
    result = result.replace(pattern, (match) => matchCase(match, value));
  }
  return result;
}

function matchCase(source: string, replacement: string): string {
  if (source.length === 0 || replacement.length === 0) return replacement;
  const first = source[0] as string;
  if (first === first.toUpperCase() && first !== first.toLowerCase()) {
    return (replacement[0] as string).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
