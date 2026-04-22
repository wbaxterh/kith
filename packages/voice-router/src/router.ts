import type {
  EventHandler,
  KithEvent,
  PersonaMode,
  PronunciationDict,
  RuntimeAdapter,
  SlangDict,
  TextTransform,
  TextTransformContext,
  Unsubscribe,
} from "@kith/core";

import type { VoiceCharacter } from "./character.ts";
import { SentenceChunker } from "./chunker.ts";
import {
  analyzeEmojis,
  DEFAULT_EMOJI_MAP,
  dominantHint,
  type EmotionHint,
} from "./emoji-sentiment.ts";
import { applyPronunciation } from "./pronunciation.ts";

export interface VoiceRouterOptions {
  runtime: RuntimeAdapter;
  /**
   * Convenience: apply a `VoiceCharacter` profile at construction. Explicit
   * options on this object take precedence over character fields. Voice-side
   * settings (voiceId, modelId, stability, …) on the character are ignored
   * by the router — extract them with `voiceCharacterToRuntimeConfig` and
   * pass them to your RuntimeAdapter's config.
   */
  character?: VoiceCharacter;
  /**
   * Abbreviation expansion map, applied before pronunciation. Use for slang,
   * jargon, and text-speak that the TTS needs spelled out ("omg" → "oh my
   * god", "fs" → "frontside"). Compose from the exported defaults via spread.
   */
  slang?: SlangDict;
  pronunciation?: PronunciationDict;
  /** Transforms applied in order to each sentence before `runtime.sendText`. */
  transforms?: TextTransform[];
  personaMode?: PersonaMode;
  /** Drop identical sentences within this window. Guards against double-sends
   * in React strict mode and flaky LLM retries. Default: 1000 ms. `0` disables. */
  dedupeWindowMs?: number;
  /** Optional override for sentence chunker settings. */
  maxBufferChars?: number;
  /**
   * Emoji → emotion map. When a message contains a known emoji, VoiceRouter
   * emits an `emotion_state` event and passes the stripped text to TTS.
   * Unknown emojis are still stripped (they'd otherwise be read aloud) but
   * produce no event. Pass `null` to disable parsing entirely. Default:
   * `DEFAULT_EMOJI_MAP`.
   */
  emojiMap?: Record<string, EmotionHint> | null;
}

/**
 * VoiceRouter — sentence-aware chunking, emoji→emotion translation,
 * pronunciation overrides, and a text-transform pipeline in front of a
 * RuntimeAdapter.
 *
 * Subscribe via `.on(handler)` to receive BOTH runtime events (turns, TTS
 * lifecycle, audio chunks) AND router-synthesized events (`emotion_state`
 * parsed from emojis). Use the router's `on()` rather than the runtime's
 * `on()` — the router is the complete consumer-facing event surface.
 */
export class VoiceRouter {
  private readonly runtime: RuntimeAdapter;
  private readonly chunker: SentenceChunker;
  private slang: SlangDict;
  private pronunciation: PronunciationDict;
  private readonly transforms: TextTransform[];
  private personaMode: PersonaMode;
  private readonly dedupeWindowMs: number;
  private readonly emojiMap: Record<string, EmotionHint> | null;
  private readonly subscribers = new Set<EventHandler>();
  private readonly runtimeUnsub: Unsubscribe;
  private lastSpokenAt = new Map<string, number>();

  constructor(options: VoiceRouterOptions) {
    this.runtime = options.runtime;
    this.chunker = new SentenceChunker(
      options.maxBufferChars !== undefined ? { maxBufferChars: options.maxBufferChars } : {},
    );
    const char = options.character;
    this.slang = options.slang ?? char?.slang ?? {};
    this.pronunciation = options.pronunciation ?? char?.pronunciation ?? {};
    this.transforms = [...(options.transforms ?? [])];
    this.personaMode = options.personaMode ?? char?.personaMode ?? "neutral";
    this.dedupeWindowMs = options.dedupeWindowMs ?? 1000;
    // Explicit emojiMap wins; then character's; then default. `null` is valid
    // at either level to disable emoji parsing entirely.
    this.emojiMap =
      options.emojiMap !== undefined
        ? options.emojiMap
        : char?.emojiMap !== undefined
          ? char.emojiMap
          : DEFAULT_EMOJI_MAP;
    this.runtimeUnsub = this.runtime.on((event) => this.dispatch(event));
  }

  /** Dispose of the runtime subscription. Call when the router is no longer
   * in use (e.g., on WebSocket close in a server context). */
  destroy(): void {
    this.runtimeUnsub();
    this.subscribers.clear();
  }

  /** Subscribe to the router's event stream (runtime events + synthesized
   * `emotion_state` events). */
  on(handler: EventHandler): Unsubscribe {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  /** Speak a complete piece of text. Emojis become emotion_state events;
   * the stripped text is chunked at sentence boundaries and streamed. */
  async speak(text: string): Promise<void> {
    const cleaned = this.consumeEmojis(text);
    const chunks = [...this.chunker.feed(cleaned), ...this.chunker.flush()];
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
      const cleaned = this.consumeEmojis(slice);
      const ready = this.chunker.feed(cleaned);
      for (const chunk of ready) {
        await this.sendChunk(chunk);
      }
    }
    for (const chunk of this.chunker.flush()) {
      await this.sendChunk(chunk);
    }
  }

  setSlang(dict: SlangDict): void {
    this.slang = dict;
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

  private consumeEmojis(text: string): string {
    if (this.emojiMap === null) return text;
    const { strippedText, hints } = analyzeEmojis(text, this.emojiMap);
    const dominant = dominantHint(hints);
    if (dominant !== null) {
      this.dispatch({
        type: "emotion_state",
        timestamp: Date.now(),
        state: dominant.state,
        intensity: dominant.intensity,
      });
    }
    return strippedText;
  }

  private async sendChunk(raw: string): Promise<void> {
    const ctx: TextTransformContext = { personaMode: this.personaMode };
    // Order: slang expands first (produces real words) → pronunciation
    // corrects any remaining mispronunciations → transforms get the last say.
    let text = applyPronunciation(raw, this.slang);
    text = applyPronunciation(text, this.pronunciation);
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

  private dispatch(event: KithEvent): void {
    for (const h of this.subscribers) {
      try {
        const out = h(event);
        if (out !== undefined) void out;
      } catch (err) {
        console.error("kith: voice-router handler threw", err);
      }
    }
  }

  private pruneDedupeMap(now: number): void {
    const cutoff = now - this.dedupeWindowMs;
    for (const [key, ts] of this.lastSpokenAt) {
      if (ts < cutoff) this.lastSpokenAt.delete(key);
    }
  }
}
