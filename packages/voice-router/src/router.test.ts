import { describe, expect, it } from "bun:test";
import type { EventHandler, RuntimeAdapter, RuntimeConfig, Unsubscribe } from "@kith/core";

import { VoiceRouter } from "./router.ts";

class CaptureRuntime implements RuntimeAdapter {
  texts: string[] = [];
  async connect(_: RuntimeConfig): Promise<void> {}
  async disconnect(): Promise<void> {}
  async sendText(text: string): Promise<void> {
    this.texts.push(text);
  }
  async sendAudio(_: ArrayBuffer): Promise<void> {}
  async bargeIn(): Promise<void> {}
  on(_handler: EventHandler): Unsubscribe {
    return () => {};
  }
}

describe("VoiceRouter", () => {
  it("forwards one sentence per sendText call", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({ runtime });
    await router.speak("Hello there. How are you? Good to see you.");
    expect(runtime.texts).toEqual(["Hello there.", "How are you?", "Good to see you."]);
  });

  it("applies pronunciation overrides", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({
      runtime,
      pronunciation: { kickflip: "kick flip" },
    });
    await router.speak("Nice kickflip! Again.");
    expect(runtime.texts).toEqual(["Nice kick flip!", "Again."]);
  });

  it("runs transforms in order with persona context", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({
      runtime,
      personaMode: "hype",
      transforms: [
        (text, ctx) => (ctx.personaMode === "hype" ? `${text} Let's go.` : text),
        (text) => text.toUpperCase(),
      ],
    });
    await router.speak("Ready.");
    expect(runtime.texts).toEqual(["READY. LET'S GO."]);
  });

  it("dedupes repeated sentences within window", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({ runtime, dedupeWindowMs: 1000 });
    await router.speak("Stop. Stop. ");
    expect(runtime.texts).toEqual(["Stop."]);
  });

  it("dedupe disabled when window is 0", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({ runtime, dedupeWindowMs: 0 });
    await router.speak("Stop. Stop. ");
    expect(runtime.texts).toEqual(["Stop.", "Stop."]);
  });

  it("emits emotion_state when emojis parse to a hint; strips from TTS text", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({ runtime });
    const events: unknown[] = [];
    router.on((e) => {
      events.push(e);
    });

    await router.speak("That's fire 🔥. Amazing work!");

    const emotions = events.filter(
      (e): e is { type: "emotion_state"; state: string } =>
        (e as { type?: string }).type === "emotion_state",
    );
    expect(emotions.length).toBe(1);
    expect(emotions[0]?.state).toBe("excited");
    // Emoji removed from TTS payload; chunker trims surrounding whitespace.
    expect(runtime.texts).toEqual(["That's fire .", "Amazing work!"]);
  });

  it("streamText emits sentences as they complete", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({ runtime });
    const tokens = async function* (): AsyncIterable<string> {
      yield "Hello ";
      yield "there.";
      yield " How";
      yield " are you?";
      yield " No tail";
    };
    await router.streamText(tokens());
    expect(runtime.texts).toEqual(["Hello there.", "How are you?", "No tail"]);
  });
});
