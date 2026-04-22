/**
 * End-to-end smoke: "haha" gets translated to [laughs] by the laugh-tag
 * dict, eleven_v3 renders it as real laughter. Writes combined audio to
 * .smoke-output/v3-laugh.mp3 so a human can listen.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { KithEvent, TtsAudioChunkEvent } from "@kith/core";

const PORT = Number(process.env.PORT ?? 3030);
const OUT = path.resolve(process.cwd(), ".smoke-output");

async function main(): Promise<void> {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const chunks: Buffer[] = [];
  const ready = Promise.withResolvers<void>();
  const done = Promise.withResolvers<void>();

  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data as string) as KithEvent | { type: "_ready" };
    if (msg.type === "_ready") {
      ready.resolve();
      return;
    }
    if (msg.type === "tts_audio_chunk") {
      const c = msg as TtsAudioChunkEvent;
      chunks.push(Buffer.from(c.audioB64, "base64"));
      console.log(`[audio] turn=${c.turnId} chunk=${c.chunkId} b64=${c.audioB64.length}`);
    } else if (msg.type === "turn_end") {
      console.log("[turn_end]");
    } else if (msg.type === "emotion_state") {
      console.log(`[emotion_state] ${msg.state}`);
    } else if (msg.type === "error") {
      done.reject(new Error(msg.message));
    } else {
      console.log(`[${msg.type}]`);
    }
  });

  await new Promise<void>((r) =>
    ws.addEventListener("open", () => r(), { once: true }),
  );
  await ready.promise;

  ws.send(
    JSON.stringify({
      type: "speak",
      text: "That's so funny haha. I cannot believe it, lol. hehe wait there's more.",
    }),
  );

  await Promise.race([
    new Promise<void>((r) => setTimeout(r, 15000)),
    done.promise,
  ]);
  ws.close();

  if (chunks.length === 0) {
    console.error("FAIL: no audio");
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });
  const outPath = path.join(OUT, "v3-laugh.mp3");
  const total = Buffer.concat(chunks);
  await writeFile(outPath, total);
  console.log(`\nwrote ${total.length} bytes → ${outPath}`);

  if (process.platform === "darwin") {
    const p = Bun.spawn(["afplay", outPath]);
    await p.exited;
  }
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
