import { describe, expect, it } from "bun:test";

import { applyPronunciation } from "./pronunciation.ts";

describe("applyPronunciation", () => {
  it("replaces whole-word matches case-insensitively", () => {
    expect(applyPronunciation("I did a kickflip", { kickflip: "kick flip" })).toBe(
      "I did a kick flip",
    );
  });

  it("preserves leading-cap casing on the replacement", () => {
    expect(applyPronunciation("Kickflip trick", { kickflip: "kick flip" })).toBe("Kick flip trick");
  });

  it("does not match partial words", () => {
    expect(applyPronunciation("kickflipping is fun", { kickflip: "kick flip" })).toBe(
      "kickflipping is fun",
    );
  });

  it("handles multiple overrides", () => {
    const out = applyPronunciation("I did a kickflip then an ollie", {
      kickflip: "kick flip",
      ollie: "aw lee",
    });
    expect(out).toBe("I did a kick flip then an aw lee");
  });

  it("passes through when dict is empty", () => {
    expect(applyPronunciation("unchanged", {})).toBe("unchanged");
  });

  it("escapes regex metacharacters in keys", () => {
    // Ensures a pathological key like "a+b" doesn't become a quantifier.
    expect(applyPronunciation("a+b and aaab", { "a+b": "x" })).toBe("x and aaab");
  });
});
