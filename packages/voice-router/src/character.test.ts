import { describe, expect, it } from "bun:test";
import type { EventHandler, RuntimeAdapter, RuntimeConfig, Unsubscribe } from "@kithjs/core";

import {
  applyVoiceCharacter,
  type VoiceCharacter,
  voiceCharacterToRuntimeConfig,
} from "./character.ts";
import { VoiceRouter } from "./router.ts";
import { DEFAULT_LAUGH_TAGS } from "./slang-defaults.ts";

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

describe("VoiceCharacter", () => {
  it("VoiceRouter picks up slang + pronunciation + personaMode from character", async () => {
    const runtime = new CaptureRuntime();
    const character: VoiceCharacter = {
      slang: { fs: "frontside" },
      pronunciation: { ganbare: "gahn-bah-ray" },
      personaMode: "hype",
    };
    const router = new VoiceRouter({ runtime, character });
    await router.speak("Ganbare! That fs 270 was clean.");
    // "!" is a sentence boundary, so two chunks. Both layers apply.
    expect(runtime.texts).toEqual(["Gahn-bah-ray!", "That frontside 270 was clean."]);
    expect(router.getPersonaMode()).toBe("hype");
  });

  it("explicit options win over character fields", async () => {
    const runtime = new CaptureRuntime();
    const character: VoiceCharacter = {
      slang: { fs: "frontside" },
      personaMode: "hype",
    };
    const router = new VoiceRouter({
      runtime,
      character,
      slang: { fs: "front-side" }, // explicit wins
      personaMode: "calm",
    });
    await router.speak("fs is dope.");
    expect(runtime.texts).toEqual(["front-side is dope."]);
    expect(router.getPersonaMode()).toBe("calm");
  });

  it("voiceCharacterToRuntimeConfig returns voice settings as plain object", () => {
    const character: VoiceCharacter = {
      voice: { voiceId: "abc", modelId: "eleven_v3", stability: 0.3 },
      slang: { fs: "frontside" },
    };
    expect(voiceCharacterToRuntimeConfig(character)).toEqual({
      voiceId: "abc",
      modelId: "eleven_v3",
      stability: 0.3,
    });
  });

  it("voiceCharacterToRuntimeConfig returns {} when voice is absent", () => {
    expect(voiceCharacterToRuntimeConfig({})).toEqual({});
  });

  it("applyVoiceCharacter mutates an existing router", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({ runtime, slang: { fs: "frontside" } });

    // Initial behavior
    await router.speak("fs test.");
    expect(runtime.texts).toEqual(["frontside test."]);

    // Hot-swap character
    applyVoiceCharacter(router, {
      slang: { fs: "FRONTSIDE" },
      personaMode: "coach",
    });
    await router.speak("fs again.");
    expect(runtime.texts).toEqual(["frontside test.", "FRONTSIDE again."]);
    expect(router.getPersonaMode()).toBe("coach");
  });

  it("character.emojiMap=null disables emoji parsing for that character", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({ runtime, character: { emojiMap: null } });
    const events: unknown[] = [];
    router.on((e) => {
      events.push(e);
    });
    await router.speak("Nice 🔥!");
    // Emoji stays in text (no stripping), no emotion_state emitted.
    expect(runtime.texts[0]).toContain("🔥");
    expect(events.some((e) => (e as { type?: string }).type === "emotion_state")).toBe(false);
  });
});

describe("DEFAULT_LAUGH_TAGS", () => {
  it("maps common laugh text to v3 audio tags", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({ runtime, slang: DEFAULT_LAUGH_TAGS });
    await router.speak("haha that was wild. lol for real. hehe cute.");
    expect(runtime.texts).toEqual([
      "[laughs] that was wild.",
      "[laughs] for real.",
      "[giggles] cute.",
    ]);
  });

  it("layers cleanly with other slang dicts", async () => {
    const runtime = new CaptureRuntime();
    const router = new VoiceRouter({
      runtime,
      slang: { ...DEFAULT_LAUGH_TAGS, fr: "for real" },
    });
    await router.speak("lol fr that was sick.");
    expect(runtime.texts).toEqual(["[laughs] for real that was sick."]);
  });
});
