import { describe, expect, it } from "bun:test";

import { analyzeEmojis, DEFAULT_EMOJI_MAP, dominantHint } from "./emoji-sentiment.ts";

describe("analyzeEmojis", () => {
  it("strips emojis and collects hints in order", () => {
    const r = analyzeEmojis("Great! 😊 That's fire 🔥");
    // Whitespace around stripped emojis is preserved deliberately — the
    // chunker trims each emitted sentence independently.
    expect(r.strippedText).toBe("Great!  That's fire ");
    expect(r.hints.map((h) => h.state)).toEqual(["happy", "excited"]);
  });

  it("passes through plain text unchanged", () => {
    expect(analyzeEmojis("No emojis here.")).toEqual({
      strippedText: "No emojis here.",
      hints: [],
    });
  });

  it("strips unmapped emojis but emits no hints for them", () => {
    const r = analyzeEmojis("Hey 🦄 there", DEFAULT_EMOJI_MAP);
    expect(r.strippedText).toBe("Hey  there");
    expect(r.hints).toEqual([]);
  });

  it("respects a custom map", () => {
    const r = analyzeEmojis("Nice 🔥", { "🔥": { state: "hyped", intensity: 1 } });
    expect(r.hints).toEqual([{ state: "hyped", intensity: 1 }]);
  });

  it("does not collapse caller whitespace (streaming-safe)", () => {
    // Token-stream case: leading/trailing whitespace is the word boundary.
    expect(analyzeEmojis("Hello ").strippedText).toBe("Hello ");
    expect(analyzeEmojis(" there.").strippedText).toBe(" there.");
  });
});

describe("dominantHint", () => {
  it("returns null on empty input", () => {
    expect(dominantHint([])).toBeNull();
  });

  it("picks the highest intensity", () => {
    const h = dominantHint([
      { state: "happy", intensity: 0.4 },
      { state: "excited", intensity: 0.9 },
      { state: "calm", intensity: 0.2 },
    ]);
    expect(h).toEqual({ state: "excited", intensity: 0.9 });
  });

  it("ties go to the first", () => {
    const h = dominantHint([
      { state: "happy", intensity: 0.5 },
      { state: "sad", intensity: 0.5 },
    ]);
    expect(h?.state).toBe("happy");
  });
});
