/**
 * Regression: a real Gen Z / skate-talk message with mixed-valence emojis
 * should synthesize cleanly, expand slang, and land on a positive emotion.
 *
 * Assumes the server is running (bun run dev in apps/demo-web).
 */

import type { KithEvent } from "@kithjs/core";

const PORT = Number(process.env.PORT ?? 3030);

const MESSAGE =
  "WAITTT you're dropping the edit here?? OMG i'm so hyped to see it ahhh!! 😭💕 fs 270 sw fs board sameway 450 out is SO sick, and a stale back 5?? you were sending it fr!! 🔥";

async function main(): Promise<void> {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const events: KithEvent[] = [];
  const ready = Promise.withResolvers<void>();
  const done = Promise.withResolvers<void>();

  let turnEnds = 0;

  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data as string);
    if (msg.type === "_ready") {
      ready.resolve();
      return;
    }
    events.push(msg);
    if (msg.type === "emotion_state") {
      console.log(`[emotion_state] ${msg.state} @ ${msg.intensity.toFixed(2)}`);
    } else if (msg.type === "tts_audio_chunk") {
      console.log(`[audio] turn=${msg.turnId} chunk=${msg.chunkId} b64=${msg.audioB64.length}`);
    } else if (msg.type === "turn_end") {
      turnEnds++;
    } else if (msg.type === "error") {
      console.error("[error]", msg.message);
      done.reject(new Error(msg.message));
    }
  });

  await new Promise<void>((r) => ws.addEventListener("open", () => r(), { once: true }));
  await ready.promise;

  ws.send(JSON.stringify({ type: "speak", text: MESSAGE }));

  // Allow enough time for ~4 sentences synthesizing at ElevenLabs pace.
  await Promise.race([new Promise<void>((r) => setTimeout(r, 25000)), done.promise]);
  ws.close();

  const emotions = events.filter(
    (e): e is { type: "emotion_state"; state: string; intensity: number; timestamp: number } =>
      e.type === "emotion_state",
  );
  const turnStarts = events.filter((e) => e.type === "turn_start").length;
  const audioChunks = events.filter((e) => e.type === "tts_audio_chunk").length;

  console.log(`\nturn_starts=${turnStarts} turn_ends=${turnEnds} audio_chunks=${audioChunks}`);
  console.log(`dominant emotion: ${emotions[0]?.state} @ ${emotions[0]?.intensity}`);

  if (emotions.length === 0) {
    console.error("FAIL: expected an emotion_state event");
    process.exit(1);
  }

  // Mixed emojis 😭💕🔥 — post-fix, positive must win.
  const dominant = emotions[0]?.state ?? "";
  const positiveStates = ["excited", "happy", "affectionate", "amused", "celebrating"];
  if (!positiveStates.includes(dominant)) {
    console.error(`FAIL: expected a positive emotion, got "${dominant}"`);
    process.exit(1);
  }

  if (turnStarts < 3) {
    console.error(`FAIL: expected >= 3 sentence turns, got ${turnStarts}`);
    process.exit(1);
  }
  if (turnEnds < 3) {
    console.error(`FAIL: expected >= 3 turn_ends, got ${turnEnds}`);
    process.exit(1);
  }

  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
