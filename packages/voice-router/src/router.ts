import type {
  PersonaMode,
  PronunciationDict,
  RuntimeAdapter,
  TextTransform,
  TextTransformContext,
} from "@kith/core";

import { SentenceChunker } from "./chunker.ts";
import { applyPronunciation } from "./pronunciation.ts";

export interface VoiceRouterOptions {
  runtime: RuntimeAdapter;
  pronunciation?: PronunciationDict;
  /** Transforms applied in order to each sentence before `runtime.sendText`. */
  transforms?: TextTransform[];
  personaMode?: PersonaMode;
  /** Drop identical sentences within this window. Guards against double-sends
   * in React strict mode and flaky LLM retries. Default: 1000 ms. `0` disables. */
  dedupeWindowMs?: number;
  /** Optional override for sentence chunker settings. */
  maxBufferChars?: number;
}

/**
 * VoiceRouter — sentence-aware chunking, pronunciation overrides, and a
 * text-transform pipeline in front of a RuntimeAdapter.
 *
 * Consumers call `.speak(text)` or `.streamText(iter)` instead of calling
 * `runtime.sendText` directly. The router splits at sentence boundaries and
 * sends one chunk per sentence — which is the single biggest lever for voice
 * naturalness per the project's Pattern A findings in the phase-1 plan.
 */
export class VoiceRouter {
  private readonly runtime: RuntimeAdapter;
  private readonly chunker: SentenceChunker;
  private pronunciation: PronunciationDict;
  private readonly transforms: TextTransform[];
  private personaMode: PersonaMode;
  private readonly dedupeWindowMs: number;
  private lastSpokenAt = new Map<string, number>();

  constructor(options: VoiceRouterOptions) {
    this.runtime = options.runtime;
    this.chunker = new SentenceChunker(
      options.maxBufferChars !== undefined ? { maxBufferChars: options.maxBufferChars } : {},
    );
    this.pronunciation = options.pronunciation ?? {};
    this.transforms = [...(options.transforms ?? [])];
    this.personaMode = options.personaMode ?? "neutral";
    this.dedupeWindowMs = options.dedupeWindowMs ?? 1000;
  }

  /** Speak a complete piece of text. Chunks at sentence boundaries. */
  async speak(text: string): Promise<void> {
    const chunks = [...this.chunker.feed(text), ...this.chunker.flush()];
    for (const chunk of chunks) {
      await this.sendChunk(chunk);
    }
  }

  /**
   * Consume an async iterable of text slices (e.g., LLM token stream) and
   * emit sentences as they complete. Handles the tail at end-of-iteration.
   */
  async streamText(iter: AsyncIterable<string>): Promise<void> {
    for await (const slice of iter) {
      const ready = this.chunker.feed(slice);
      for (const chunk of ready) {
        await this.sendChunk(chunk);
      }
    }
    for (const chunk of this.chunker.flush()) {
      await this.sendChunk(chunk);
    }
  }

  setPronunciation(dict: PronunciationDict): void {
    this.pronunciation = dict;
  }

  /** Add a transform to the pipeline. Returns an unsubscribe function. */
  addTransform(fn: TextTransform): () => void {
    this.transforms.push(fn);
    return () => {
      const idx = this.transforms.indexOf(fn);
      if (idx >= 0) this.transforms.splice(idx, 1);
    };
  }

  setPersonaMode(mode: PersonaMode): void {
    this.personaMode = mode;
  }

  getPersonaMode(): PersonaMode {
    return this.personaMode;
  }

  private async sendChunk(raw: string): Promise<void> {
    const ctx: TextTransformContext = { personaMode: this.personaMode };
    let text = applyPronunciation(raw, this.pronunciation);
    for (const fn of this.transforms) {
      text = fn(text, ctx);
    }
    const trimmed = text.trim();
    if (trimmed === "") return;

    if (this.dedupeWindowMs > 0) {
      const now = Date.now();
      const prev = this.lastSpokenAt.get(trimmed);
      if (prev !== undefined && now - prev < this.dedupeWindowMs) return;
      this.lastSpokenAt.set(trimmed, now);
      this.pruneDedupeMap(now);
    }

    await this.runtime.sendText(trimmed);
  }

  private pruneDedupeMap(now: number): void {
    const cutoff = now - this.dedupeWindowMs;
    for (const [key, ts] of this.lastSpokenAt) {
      if (ts < cutoff) this.lastSpokenAt.delete(key);
    }
  }
}
