import { describe, expect, it } from "bun:test";
import type { EventHandler, RuntimeAdapter, RuntimeConfig, Unsubscribe } from "@kithjs/core";

import { VoiceRouter } from "./router.ts";
import {
  DEFAULT_BOARD_SPORTS_SLANG,
  DEFAULT_ENGLISH_SLANG,
  DEFAULT_GENZ_SLANG,
} from "./slang-defaults.ts";

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

describe("VoiceRouter with slang dicts", () => {
  it("expands English abbreviations (lowercase input stays lowercase)", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({ runtime, slang: DEFAULT_ENGLISH_SLANG });
    await router.speak("omg that's wild. btw, idk what to say.");
    expect(runtime.texts).toEqual([
      "oh my god that's wild.",
      "by the way, I don't know what to say.",
    ]);
  });

  it("preserves leading cap when input is capitalized", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({ runtime, slang: DEFAULT_ENGLISH_SLANG });
    await router.speak("OMG that's wild. Btw, this works.");
    expect(runtime.texts).toEqual(["Oh my god that's wild.", "By the way, this works."]);
  });

  it("expands Gen Z shorthand", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({ runtime, slang: DEFAULT_GENZ_SLANG });
    await router.speak("that's mid ngl. Fr though.");
    expect(runtime.texts).toEqual(["that's mid not gonna lie.", "For real though."]);
  });

  it("expands board-sports trick names", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({ runtime, slang: DEFAULT_BOARD_SPORTS_SLANG });
    await router.speak("fs 270 sw. stoked on that halfcab.");
    expect(runtime.texts).toEqual(["frontside 270 switch.", "stoked on that half cab."]);
  });

  it("composes multiple dicts via spread", async () => {
    const runtime = new CaptureRuntime();
    const composed = {
      ...DEFAULT_ENGLISH_SLANG,
      ...DEFAULT_GENZ_SLANG,
      ...DEFAULT_BOARD_SPORTS_SLANG,
    };
    const router = new VoiceRouter({ runtime, slang: composed });
    await router.speak("omg a fs 270 sw is fr the sickest move.");
    expect(runtime.texts[0]).toBe("oh my god a frontside 270 switch is for real the sickest move.");
  });

  it("slang applies before pronunciation (composable layers)", async () => {
    const runtime = new CaptureRuntime();
    // slang: "kf" → "kickflip". pronunciation: "kickflip" → "kick flip".
    const router = new VoiceRouter({
      runtime,
      slang: { kf: "kickflip" },
      pronunciation: { kickflip: "kick flip" },
    });
    await router.speak("nice kf bro.");
    expect(runtime.texts).toEqual(["nice kick flip bro."]);
  });
});
