/**
 * Real-TTS smoke test — synthesizes via ElevenLabs, concatenates audio chunks
 * across the turn, writes to disk, plays via `afplay` on macOS.
 *
 * Requires:
 *   ELEVENLABS_API_KEY      — your ElevenLabs API key
 *   ELEVENLABS_VOICE_ID     — voice to synthesize with
 *
 * Run:
 *   bun packages/runtime-pipecat/src/__smoke__/real-tts.ts "Your phrase"
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { KithEvent, TtsAudioChunkEvent } from "@kith/core";

import { PipecatRuntime } from "../runtime.ts";

const HERE = path.dirname(Bun.fileURLToPath(import.meta.url));
const PYTHON_VENV = path.resolve(HERE, "../../python/.venv/bin/python");
const PYTHON_CWD = path.resolve(HERE, "../../python");
const OUT_DIR = path.resolve(HERE, "../../.smoke-output");

async function main(): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (apiKey === undefined || voiceId === undefined) {
    console.error("set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to run this test");
    process.exit(2);
  }

  const text = process.argv[2] ?? "Hey from Kith. Voice output is wired up end to end.";
  const runtime = new PipecatRuntime({
    pythonPath: PYTHON_VENV,
    cwd: PYTHON_CWD,
    config: {
      pipeline: "elevenlabs",
      apiKey,
      voiceId,
      modelId: "eleven_multilingual_v2",
      stability: 0.5,
      similarityBoost: 0.85,
      style: 0.3,
      useSpeakerBoost: true,
      outputFormat: "mp3_44100_128",
    },
  });

  const chunks: Buffer[] = [];
  let mimeType = "audio/mpeg";
  const turnEnded = Promise.withResolvers<void>();

  runtime.on((event: KithEvent) => {
    switch (event.type) {
      case "tts_audio_chunk": {
        const e = event as TtsAudioChunkEvent;
        chunks.push(Buffer.from(e.audioB64, "base64"));
        mimeType = e.mimeType;
        console.log(
          `[tts_audio_chunk] turn=${e.turnId} chunk=${e.chunkId} bytes=${chunks.at(-1)?.length}`,
        );
        break;
      }
      case "turn_end":
        console.log("[turn_end]");
        turnEnded.resolve();
        break;
      case "error":
        console.error("[error]", event.message);
        turnEnded.reject(new Error(event.message));
        break;
      default:
        console.log(`[${event.type}]`);
    }
  });

  await runtime.connect({ sessionId: "real-tts-smoke" });
  await runtime.sendText(text);
  await turnEnded.promise;
  await runtime.disconnect();

  if (chunks.length === 0) {
    console.error("FAIL: no audio received");
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const ext = mimeType === "audio/mpeg" ? "mp3" : "wav";
  const outPath = path.join(OUT_DIR, `real-tts.${ext}`);
  const total = Buffer.concat(chunks);
  await writeFile(outPath, total);
  console.log(`\nwrote ${total.length} bytes → ${outPath}`);

  if (process.platform === "darwin") {
    const player = Bun.spawn(["afplay", outPath]);
    await player.exited;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
