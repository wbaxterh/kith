/**
 * End-to-end barge-in regression:
 *   1. send a long multi-sentence utterance
 *   2. after the first chunk arrives, call bargeIn()
 *   3. assert: barge_in_detected fires; remaining sentences don't synthesize;
 *      a follow-up sendText works cleanly on the same runtime.
 *
 * Tests the full path against ElevenLabs (not the mock), since the mock
 * smoke already covers the protocol contract.
 */

import path from "node:path";
import type { KithEvent } from "@kith/core";

import { PipecatRuntime } from "../runtime.ts";

const HERE = path.dirname(Bun.fileURLToPath(import.meta.url));
const PYTHON_VENV = path.resolve(HERE, "../../python/.venv/bin/python");
const PYTHON_CWD = path.resolve(HERE, "../../python");

async function main(): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (apiKey === undefined || voiceId === undefined) {
    console.error("set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to run this test");
    process.exit(2);
  }

  const events: KithEvent[] = [];
  const runtime = new PipecatRuntime({
    pythonPath: PYTHON_VENV,
    cwd: PYTHON_CWD,
    config: { pipeline: "elevenlabs", apiKey, voiceId, modelId: "eleven_v3" },
  });

  const firstAudio = Promise.withResolvers<void>();
  const bargeInFired = Promise.withResolvers<void>();

  runtime.on((e) => {
    events.push(e);
    if (e.type === "tts_audio_chunk") {
      console.log(`[tts_audio_chunk] turn=${e.turnId} chunk=${e.chunkId}`);
      firstAudio.resolve();
    } else if (e.type === "barge_in_detected") {
      console.log(`[barge_in_detected] turn=${e.turnId}`);
      bargeInFired.resolve();
    } else {
      console.log(`[${e.type}]`);
    }
  });

  await runtime.connect({ sessionId: "barge-in-smoke" });

  // Long utterance — chunker splits into 4 sentences.
  await runtime.sendText(
    "First sentence here. Second one is coming now. Third should never play. Fourth is also dead.",
  );

  await firstAudio.promise;
  console.log("\n→ first audio received, firing bargeIn()");
  await runtime.bargeIn();

  await Promise.race([
    bargeInFired.promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("no barge_in_detected")), 5000)),
  ]);

  // Wait a beat to make sure no more audio sneaks through.
  const audioBeforeFollowup = events.filter((e) => e.type === "tts_audio_chunk").length;
  await new Promise((r) => setTimeout(r, 1500));
  const audioAfterBargeSettle = events.filter((e) => e.type === "tts_audio_chunk").length;

  if (audioAfterBargeSettle > audioBeforeFollowup + 1) {
    console.error(
      `FAIL: too many audio chunks after barge-in (${audioBeforeFollowup} → ${audioAfterBargeSettle}); ` +
        "synthesis didn't actually stop",
    );
    await runtime.disconnect();
    process.exit(1);
  }

  // Follow-up sendText must still work.
  console.log("\n→ sending follow-up after barge-in");
  const followupDone = Promise.withResolvers<void>();
  let followupChunks = 0;
  const beforeFollowup = events.length;
  runtime.on((e) => {
    if (e.type === "tts_audio_chunk" && events.indexOf(e) >= beforeFollowup) {
      followupChunks += 1;
    } else if (e.type === "turn_end" && events.indexOf(e) >= beforeFollowup) {
      followupDone.resolve();
    }
  });

  await runtime.sendText("Recovery works.");
  await Promise.race([
    followupDone.promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("no follow-up turn_end")), 10000)),
  ]);

  await runtime.disconnect();

  if (followupChunks < 1) {
    console.error("FAIL: follow-up sendText produced no audio");
    process.exit(1);
  }
  console.log("\nPASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
