/**
 * End-to-end regression: multi-sentence text with emojis.
 * Must produce:
 *   - at least one emotion_state event (from the emoji)
 *   - two turn_start / turn_end pairs (one per sentence, both complete)
 *   - at least one tts_audio_chunk per turn
 *
 * Assumes the server is already running (bun run dev).
 */

import type { KithEvent } from "@kith/core";

const PORT = Number(process.env.PORT ?? 3030);

async function main(): Promise<void> {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const events: KithEvent[] = [];
  const ready = Promise.withResolvers<void>();
  const allDone = Promise.withResolvers<void>();

  let turnEnds = 0;
  const expectedTurns = 2;

  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data as string);
    if (msg.type === "_ready") {
      console.log("[ready]");
      ready.resolve();
      return;
    }
    events.push(msg);
    if (msg.type === "emotion_state") {
      console.log(`[emotion_state] state=${msg.state} intensity=${msg.intensity}`);
    } else if (msg.type === "tts_audio_chunk") {
      console.log(`[tts_audio_chunk] turn=${msg.turnId} chunk=${msg.chunkId} b64=${msg.audioB64.length}`);
    } else if (msg.type === "turn_end") {
      turnEnds++;
      console.log(`[turn_end] (${turnEnds}/${expectedTurns})`);
      if (turnEnds >= expectedTurns) allDone.resolve();
    } else if (msg.type === "error") {
      console.error("[error]", msg.message);
      allDone.reject(new Error(msg.message));
    } else {
      console.log(`[${msg.type}]`);
    }
  });
  ws.addEventListener("error", (e) => allDone.reject(e as unknown as Error));

  await new Promise<void>((r) =>
    ws.addEventListener("open", () => r(), { once: true }),
  );
  await ready.promise;

  ws.send(
    JSON.stringify({
      type: "speak",
      text: "Dr. Smith is here. 🔥 Amazing work everyone!",
    }),
  );

  await Promise.race([
    allDone.promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 20000)),
  ]);
  ws.close();

  const types = events.map((e) => e.type);
  const emotions = events.filter((e) => e.type === "emotion_state");
  const turnStarts = types.filter((t) => t === "turn_start").length;
  const audioChunks = types.filter((t) => t === "tts_audio_chunk").length;

  console.log(
    `\nturn_starts=${turnStarts} turn_ends=${turnEnds} audio_chunks=${audioChunks} emotions=${emotions.length}`,
  );

  if (turnStarts < 2) {
    console.error("FAIL: expected >= 2 turn_starts (sentences)");
    process.exit(1);
  }
  if (turnEnds < 2) {
    console.error("FAIL: expected >= 2 turn_ends (both sentences must complete)");
    process.exit(1);
  }
  if (audioChunks < 2) {
    console.error("FAIL: expected >= 2 audio chunks (one per sentence)");
    process.exit(1);
  }
  if (emotions.length < 1) {
    console.error("FAIL: expected >= 1 emotion_state from 🔥");
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
