/**
 * OllamaAgent — bridges a local Ollama LLM with Kith's VoiceRouter.
 *
 * This is the "brain + voice" bridge: user says something → Ollama generates
 * a response → VoiceRouter chunks and speaks it with natural pacing.
 *
 * Supports streaming: as Ollama generates tokens, completed sentences are
 * spoken immediately via voice.streamText(). The user hears the first sentence
 * while the LLM is still generating the rest.
 *
 * Usage:
 *   const agent = new OllamaAgent({
 *     model: "llama3.2",
 *     systemPrompt: "You are a friendly companion named Luna.",
 *     ollamaUrl: "http://localhost:11434",
 *   });
 *
 *   agent.onTranscript((text) => console.log("Agent said:", text));
 *   await agent.respond("Hey, how are you?");
 */

export interface OllamaAgentOptions {
  /** Ollama model name (e.g. "llama3.2", "qwen2.5", "mistral") */
  model: string;
  /** System prompt that defines the companion's personality */
  systemPrompt?: string;
  /** Ollama API URL. Default: http://localhost:11434 */
  ollamaUrl?: string;
  /** Max conversation history to send. Default: 20 messages */
  maxHistory?: number;
  /** Temperature for generation. Default: 0.8 */
  temperature?: number;
  /** Max tokens to generate. Default: 300 */
  maxTokens?: number;
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export class OllamaAgent {
  private options: Required<OllamaAgentOptions>;
  private history: Message[] = [];
  private transcriptHandlers = new Set<(text: string) => void>();

  constructor(options: OllamaAgentOptions) {
    this.options = {
      model: options.model,
      systemPrompt: options.systemPrompt ?? "You are a helpful AI companion.",
      ollamaUrl: (options.ollamaUrl ?? process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/$/, ""),
      maxHistory: options.maxHistory ?? 20,
      temperature: options.temperature ?? 0.8,
      maxTokens: options.maxTokens ?? 300,
    };
  }

  /** Subscribe to full transcript of agent responses. */
  onTranscript(handler: (text: string) => void): () => void {
    this.transcriptHandlers.add(handler);
    return () => this.transcriptHandlers.delete(handler);
  }

  /** Add a message to history without generating a response. */
  addMessage(role: "user" | "assistant", content: string): void {
    this.history.push({ role, content });
    this.trimHistory();
  }

  /** Clear conversation history. */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Generate a response from Ollama and return it as a string.
   * Also adds both user message and response to history.
   */
  async respond(userMessage: string): Promise<string> {
    this.history.push({ role: "user", content: userMessage });
    this.trimHistory();

    const messages: Message[] = [
      { role: "system", content: this.options.systemPrompt },
      ...this.history,
    ];

    const response = await fetch(`${this.options.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.options.model,
        messages,
        stream: false,
        options: {
          temperature: this.options.temperature,
          num_predict: this.options.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as { message: { content: string } };
    const text = data.message.content;

    this.history.push({ role: "assistant", content: text });
    this.trimHistory();

    for (const h of this.transcriptHandlers) h(text);
    return text;
  }

  /**
   * Generate a streaming response from Ollama.
   * Returns an AsyncIterable<string> of tokens that can be fed directly
   * into voice.streamText() for real-time sentence-by-sentence TTS.
   *
   * Usage:
   *   const tokens = agent.respondStreaming("Tell me a story");
   *   await voice.streamText(tokens);
   */
  async *respondStreaming(userMessage: string): AsyncIterable<string> {
    this.history.push({ role: "user", content: userMessage });
    this.trimHistory();

    const messages: Message[] = [
      { role: "system", content: this.options.systemPrompt },
      ...this.history,
    ];

    const response = await fetch(`${this.options.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.options.model,
        messages,
        stream: true,
        options: {
          temperature: this.options.temperature,
          num_predict: this.options.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${await response.text()}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Ollama streams newline-delimited JSON
      for (const line of chunk.split("\n")) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as {
            message?: { content: string };
            done?: boolean;
          };
          if (parsed.message?.content) {
            fullText += parsed.message.content;
            yield parsed.message.content;
          }
        } catch {
          // Partial JSON line — skip
        }
      }
    }

    this.history.push({ role: "assistant", content: fullText });
    this.trimHistory();

    for (const h of this.transcriptHandlers) h(fullText);
  }

  /** Check if Ollama is reachable and the model is available. */
  async healthCheck(): Promise<{ ok: boolean; model: string; error?: string }> {
    try {
      const resp = await fetch(`${this.options.ollamaUrl}/api/tags`);
      if (!resp.ok) {
        return { ok: false, model: this.options.model, error: `HTTP ${resp.status}` };
      }
      const data = (await resp.json()) as { models: { name: string }[] };
      const available = data.models.some(
        (m) => m.name === this.options.model || m.name.startsWith(`${this.options.model}:`),
      );
      if (!available) {
        return {
          ok: false,
          model: this.options.model,
          error: `model "${this.options.model}" not found. Run: ollama pull ${this.options.model}`,
        };
      }
      return { ok: true, model: this.options.model };
    } catch (err: any) {
      return {
        ok: false,
        model: this.options.model,
        error: `Cannot reach Ollama at ${this.options.ollamaUrl}: ${err.message}`,
      };
    }
  }

  private trimHistory(): void {
    if (this.history.length > this.options.maxHistory) {
      this.history = this.history.slice(-this.options.maxHistory);
    }
  }
}
