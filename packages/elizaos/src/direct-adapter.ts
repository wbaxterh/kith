/**
 * ElevenLabsDirectAdapter — lightweight RuntimeAdapter that calls ElevenLabs
 * from TypeScript directly, without spawning a Python sidecar.
 *
 * This is the key new code that makes the ElizaOS plugin work without Python.
 * It implements the same RuntimeAdapter contract as PipecatRuntime but does
 * TTS synthesis in-process via the ElevenLabs JS SDK.
 */

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type {
  EventHandler,
  KithEvent,
  RuntimeAdapter,
  RuntimeConfig,
  Unsubscribe,
} from "@kithjs/core";

export interface DirectAdapterOptions {
  apiKey: string;
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  speed?: number;
  outputFormat?: string;
}

export class ElevenLabsDirectAdapter implements RuntimeAdapter {
  private options: DirectAdapterOptions;
  private client: ElevenLabsClient | null = null;
  private handlers = new Set<EventHandler>();
  private connected = false;
  private turnCounter = 0;
  private chunkCounter = 0;

  constructor(options: DirectAdapterOptions) {
    this.options = options;
  }

  async connect(_config: RuntimeConfig): Promise<void> {
    if (this.connected) throw new Error("already connected");
    this.client = new ElevenLabsClient({ apiKey: this.options.apiKey });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.client = null;
  }

  async sendText(text: string): Promise<void> {
    if (!this.connected || !this.client) {
      throw new Error("not connected");
    }

    const turnId = `dt-turn-${++this.turnCounter}`;
    const chunkId = `dt-chunk-${++this.chunkCounter}`;

    // turn_start
    this.dispatch({
      type: "turn_start",
      timestamp: Date.now(),
      turnId,
      role: "assistant",
    });

    // tts_start
    this.dispatch({
      type: "tts_start",
      timestamp: Date.now(),
      turnId,
      chunkId,
    });

    try {
      // Call ElevenLabs SDK
      const voiceSettings: Record<string, unknown> = {};
      if (this.options.stability !== undefined)
        voiceSettings.stability = this.options.stability;
      if (this.options.similarityBoost !== undefined)
        voiceSettings.similarity_boost = this.options.similarityBoost;
      if (this.options.style !== undefined)
        voiceSettings.style = this.options.style;
      if (this.options.useSpeakerBoost !== undefined)
        voiceSettings.use_speaker_boost = this.options.useSpeakerBoost;

      const audioResponse = await this.client.textToSpeech.convert(
        this.options.voiceId,
        {
          text,
          model_id: this.options.modelId ?? "eleven_v3",
          output_format: (this.options.outputFormat as any) ?? "mp3_44100_128",
          voice_settings: Object.keys(voiceSettings).length > 0 ? voiceSettings as any : undefined,
        },
      );

      // Collect audio bytes from the response stream
      const chunks: Uint8Array[] = [];
      if (audioResponse instanceof ReadableStream) {
        const reader = audioResponse.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
      } else if (audioResponse instanceof Blob) {
        chunks.push(new Uint8Array(await audioResponse.arrayBuffer()));
      } else if (ArrayBuffer.isView(audioResponse)) {
        chunks.push(new Uint8Array(audioResponse.buffer));
      } else {
        // Iterable of chunks
        for await (const chunk of audioResponse as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
      }

      // Concatenate and base64 encode
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const audioBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        audioBytes.set(chunk, offset);
        offset += chunk.length;
      }

      const audioB64 = bufferToBase64(audioBytes);

      // tts_audio_chunk
      this.dispatch({
        type: "tts_audio_chunk",
        timestamp: Date.now(),
        turnId,
        chunkId,
        audioB64,
        mimeType: "audio/mpeg",
      });
    } catch (err: any) {
      this.dispatch({
        type: "error",
        timestamp: Date.now(),
        message: `ElevenLabs TTS failed: ${err.message}`,
        retriable: true,
      });
    }

    // tts_end
    this.dispatch({
      type: "tts_end",
      timestamp: Date.now(),
      turnId,
      chunkId,
    });

    // turn_end
    this.dispatch({
      type: "turn_end",
      timestamp: Date.now(),
      turnId,
      role: "assistant",
    });
  }

  async sendAudio(_audio: ArrayBuffer): Promise<void> {
    // No STT in lightweight mode
  }

  async bargeIn(): Promise<void> {
    const turnId = `dt-turn-${this.turnCounter}`;
    this.dispatch({
      type: "barge_in_detected",
      timestamp: Date.now(),
      turnId,
    });
  }

  on(handler: EventHandler): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private dispatch(event: KithEvent): void {
    for (const h of this.handlers) {
      try {
        const out = h(event);
        if (out !== undefined) void out;
      } catch (err) {
        console.error("kith: direct-adapter handler threw", err);
      }
    }
  }
}

function bufferToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
