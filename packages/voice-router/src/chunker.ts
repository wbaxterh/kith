/**
 * Sentence-aware chunker for streaming assistant text.
 *
 * This is the core fix for fragment-level synthesis — buffers incoming text
 * until a terminal punctuation mark (`.`, `!`, `?`, blank line) is seen, then
 * emits that complete sentence as one chunk. The upstream TTS provider gets
 * a full sentence to synthesize with coherent prosody instead of mid-thought
 * fragments. Unterminated tails are held until `flush()` is called at
 * end-of-stream.
 */

// Match terminal punctuation (optionally followed by closing quotes/brackets)
// that is then followed by whitespace, OR a blank line. We intentionally do
// NOT match at end-of-buffer — the tail is held until a subsequent feed
// provides whitespace, or until `flush()` is called at end-of-stream. This
// keeps streaming token input from prematurely flushing when a chunk happens
// to land on a period.
const SENTENCE_END = /([.!?]["')\]]*\s+|\n{2,})/;

export interface SentenceChunkerOptions {
  /** Maximum characters to buffer before force-flushing even without terminal
   * punctuation. Guards against run-on input that would otherwise starve the
   * TTS pipeline. Default: 400. */
  maxBufferChars?: number;
}

export class SentenceChunker {
  private buffer = "";
  private readonly maxBuffer: number;

  constructor(options: SentenceChunkerOptions = {}) {
    this.maxBuffer = options.maxBufferChars ?? 400;
  }

  /** Feed a slice of text. Returns any complete sentences ready to flush. */
  feed(text: string): string[] {
    this.buffer += text;
    const out: string[] = [];

    while (true) {
      const match = SENTENCE_END.exec(this.buffer);
      if (match === null) break;

      const end = match.index + match[0].length;
      const sentence = this.buffer.slice(0, end).trim();
      this.buffer = this.buffer.slice(end);
      if (sentence !== "") out.push(sentence);
    }

    if (this.buffer.length >= this.maxBuffer) {
      const forced = this.buffer.trim();
      this.buffer = "";
      if (forced !== "") out.push(forced);
    }

    return out;
  }

  /** Emit any buffered tail. Call at end-of-stream. */
  flush(): string[] {
    const remaining = this.buffer.trim();
    this.buffer = "";
    return remaining === "" ? [] : [remaining];
  }
}
