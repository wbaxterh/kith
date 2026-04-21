import { describe, expect, it } from "bun:test";

import { SentenceChunker } from "./chunker.ts";

describe("SentenceChunker", () => {
  it("splits on terminal punctuation", () => {
    const c = new SentenceChunker();
    expect(c.feed("Hello there. How are you? I'm fine!")).toEqual(["Hello there.", "How are you?"]);
    expect(c.flush()).toEqual(["I'm fine!"]);
  });

  it("buffers across multiple feed calls", () => {
    const c = new SentenceChunker();
    expect(c.feed("Hello ")).toEqual([]);
    expect(c.feed("there.")).toEqual([]);
    expect(c.feed(" How ")).toEqual(["Hello there."]);
    expect(c.flush()).toEqual(["How"]);
  });

  it("treats blank lines as sentence boundaries", () => {
    const c = new SentenceChunker();
    expect(c.feed("First paragraph\n\nSecond paragraph")).toEqual(["First paragraph"]);
    expect(c.flush()).toEqual(["Second paragraph"]);
  });

  it("preserves closing quotes after terminal punctuation", () => {
    const c = new SentenceChunker();
    expect(c.feed('She said "go." Then she left.')).toEqual(['She said "go."']);
    expect(c.flush()).toEqual(["Then she left."]);
  });

  it("force-flushes when buffer exceeds max", () => {
    const c = new SentenceChunker({ maxBufferChars: 10 });
    expect(c.feed("abcdefghijklmno")).toEqual(["abcdefghijklmno"]);
    expect(c.flush()).toEqual([]);
  });

  it("returns no output on empty input", () => {
    const c = new SentenceChunker();
    expect(c.feed("")).toEqual([]);
    expect(c.flush()).toEqual([]);
  });

  it("flush on fully-consumed input returns nothing", () => {
    const c = new SentenceChunker();
    expect(c.feed("Done. ")).toEqual(["Done."]);
    expect(c.flush()).toEqual([]);
  });
});
