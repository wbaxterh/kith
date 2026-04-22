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
    const r = analyzeEmojis("Nice 🔥", {
      "🔥": { state: "hyped", intensity: 1, polarity: "positive" },
    });
    expect(r.hints).toEqual([{ state: "hyped", intensity: 1, polarity: "positive" }]);
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

  it("picks the highest intensity within a single polarity", () => {
    const h = dominantHint([
      { state: "happy", intensity: 0.4, polarity: "positive" },
      { state: "excited", intensity: 0.9, polarity: "positive" },
      { state: "calm", intensity: 0.2, polarity: "positive" },
    ]);
    expect(h?.state).toBe("excited");
  });

  it("positive emojis outweigh a single stronger negative (Gen Z 😭💕🔥 case)", () => {
    // This is the real-world bug: "😭💕🔥" read as excitement, not sadness.
    const h = dominantHint([
      { state: "sad", intensity: 0.9, polarity: "negative" },
      { state: "affectionate", intensity: 0.7, polarity: "positive" },
      { state: "excited", intensity: 0.8, polarity: "positive" },
    ]);
    // Positive total = 1.5 vs negative total = 0.9 → positive wins,
    // strongest positive = excited @ 0.8.
    expect(h?.state).toBe("excited");
    expect(h?.polarity).toBe("positive");
  });

  it("single strong negative beats weak positive", () => {
    const h = dominantHint([
      { state: "sad", intensity: 0.9, polarity: "negative" },
      { state: "happy", intensity: 0.3, polarity: "positive" },
    ]);
    expect(h?.state).toBe("sad");
  });

  it("neutrals win when no valenced emojis present", () => {
    const h = dominantHint([
      { state: "thoughtful", intensity: 0.5, polarity: "neutral" },
      { state: "surprised", intensity: 0.7, polarity: "neutral" },
    ]);
    expect(h?.state).toBe("surprised");
  });

  it("tie in totals breaks toward the polarity with the strongest single hint", () => {
    const h = dominantHint([
      { state: "happy", intensity: 0.6, polarity: "positive" },
      { state: "sad", intensity: 0.7, polarity: "negative" },
      // totals tie at 0.6 / 0.7; negative has the stronger single hint
    ]);
    expect(h?.state).toBe("sad");
  });
});
