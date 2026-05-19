/**
 * @kithjs/ollama — Local LLM voice conversations via Ollama.
 *
 * Bridges Ollama (local LLMs) with Kith's VoiceRouter for fully
 * local AI companion voice conversations. Zero cloud dependency.
 *
 * Quick start:
 *   import { OllamaAgent } from "@kithjs/ollama";
 *   import { VoiceRouter } from "@kithjs/voice-router";
 *   import { PipecatRuntime } from "@kithjs/runtime-pipecat";
 *
 *   const agent = new OllamaAgent({
 *     model: "llama3.2",
 *     systemPrompt: "You are Luna, a cheerful AI companion.",
 *   });
 *
 *   const runtime = new PipecatRuntime({ config: { pipeline: "piper", piperModel: "..." } });
 *   await runtime.connect({ sessionId: "local" });
 *   const voice = new VoiceRouter({ runtime });
 *
 *   // Full local voice conversation:
 *   const tokens = agent.respondStreaming("Hey Luna, what should we do today?");
 *   await voice.streamText(tokens);
 *   // → User hears Luna speak as the LLM generates, sentence by sentence
 */

export { OllamaAgent, type OllamaAgentOptions, type Message } from "./ollama-agent.ts";

/**
 * Convenience: create a fully wired local voice companion in one call.
 *
 * Returns { agent, voice, speak } where speak(text) handles the full loop:
 * user text → Ollama → VoiceRouter → TTS → audio events.
 */
export async function createLocalCompanion(options: {
  /** Ollama model name */
  model: string;
  /** Companion personality system prompt */
  systemPrompt: string;
  /** Ollama URL. Default: http://localhost:11434 */
  ollamaUrl?: string;
  /** Voice runtime (PipecatRuntime or any RuntimeAdapter). Must be connected. */
  runtime: import("@kithjs/core").RuntimeAdapter;
  /** Optional VoiceCharacter for voice settings */
  character?: import("@kithjs/voice-router").VoiceCharacter;
  /** Optional extra slang dict */
  slang?: import("@kithjs/core").SlangDict;
}) {
  const { OllamaAgent } = await import("./ollama-agent.ts");
  const { VoiceRouter, DEFAULT_ENGLISH_SLANG, DEFAULT_GENZ_SLANG, DEFAULT_LAUGH_TAGS } =
    await import("@kithjs/voice-router");

  const agent = new OllamaAgent({
    model: options.model,
    systemPrompt: options.systemPrompt,
    ollamaUrl: options.ollamaUrl,
  });

  const voice = new VoiceRouter({
    runtime: options.runtime,
    character: options.character,
    slang: {
      ...DEFAULT_ENGLISH_SLANG,
      ...DEFAULT_GENZ_SLANG,
      ...DEFAULT_LAUGH_TAGS,
      ...(options.character?.slang ?? {}),
      ...(options.slang ?? {}),
    },
  });

  /** Speak a user message: sends to Ollama, streams response through voice. */
  async function speak(userMessage: string): Promise<string> {
    const tokens = agent.respondStreaming(userMessage);
    await voice.streamText(tokens);
    // Return the full text (agent stores it in history)
    return agent.respond("").catch(() => ""); // noop — history already has it
  }

  /** Speak streaming: returns the async token iterator for manual control. */
  function respondStreaming(userMessage: string): AsyncIterable<string> {
    return agent.respondStreaming(userMessage);
  }

  return { agent, voice, speak, respondStreaming };
}
