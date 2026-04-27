/**
 * Demo smoke test — simulates a browser: opens WebSocket, sends speak,
 * verifies we receive turn_start, tts_audio_chunk(s), and turn_end.
 *
 * Assumes the server is already running (e.g., via `bun run dev`).
 */

import type { KithEvent } from "@kithjs/core";

const PORT = Number(process.env.PORT ?? 3030);

async function main(): Promise<void> {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const events: (KithEvent | { type: "_ready" })[] = [];
  const done = Promise.withResolvers<void>();
  const ready = Promise.withResolvers<void>();

  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data as string);
    events.push(msg);
    if (msg.type === "_ready") {
      console.log("[ready]");
      ready.resolve();
    } else if (msg.type === "tts_audio_chunk") {
      console.log(`[tts_audio_chunk] ${msg.audioB64.length} b64 chars`);
    } else if (msg.type === "turn_end") {
      console.log("[turn_end]");
      done.resolve();
    } else if (msg.type === "error") {
      console.error("[error]", msg.message);
      done.reject(new Error(msg.message));
    } else {
      console.log(`[${msg.type}]`);
    }
  });
  ws.addEventListener("error", (e) => done.reject(e as unknown as Error));

  await new Promise<void>((r) => ws.addEventListener("open", () => r(), { once: true }));
  await ready.promise;

  ws.send(JSON.stringify({ type: "speak", text: "Hello from the web demo." }));

  await done.promise;
  ws.close();

  const types = events.map((e) => e.type);
  const chunkCount = types.filter((t) => t === "tts_audio_chunk").length;
  console.log(`\nreceived: ${types.join(", ")}`);
  if (!types.includes("turn_start") || chunkCount === 0) {
    console.error("FAIL: missing turn_start or audio chunks");
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
