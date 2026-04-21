/**
 * Manual smoke test — spawn sidecar, send one text op, verify expected events.
 * Not part of the package exports; kept under `__smoke__/` so biome excludes
 * it from the published surface.
 *
 * Run:
 *   bun packages/runtime-pipecat/src/__smoke__/text-roundtrip.ts
 */

import path from "node:path";
import type { KithEvent } from "@kith/core";

import { PipecatRuntime } from "../runtime.ts";

const HERE = path.dirname(Bun.fileURLToPath(import.meta.url));
const PYTHON_VENV = path.resolve(HERE, "../../python/.venv/bin/python");
const PYTHON_CWD = path.resolve(HERE, "../../python");

async function main(): Promise<void> {
  const received: KithEvent[] = [];
  const runtime = new PipecatRuntime({
    pythonPath: PYTHON_VENV,
    cwd: PYTHON_CWD,
  });

  runtime.on((event) => {
    received.push(event);
    console.log(`[${event.type}]`, JSON.stringify(event));
  });

  await runtime.connect({ sessionId: "smoke-test" });
  await runtime.sendText("Hello from Kith. How's the ride?");

  // Mock pipeline sleeps ~40ms/char per chunk, two short sentences.
  await new Promise((r) => setTimeout(r, 2500));

  await runtime.disconnect();

  const types = received.map((e) => e.type);
  console.log("\n---\nevent types in order:", types);

  const expected = ["turn_start", "tts_start", "tts_end", "tts_start", "tts_end", "turn_end"];
  const matches = expected.every((t, i) => types[i] === t);
  if (!matches) {
    console.error(`FAIL: expected ${expected.join(",")} got ${types.join(",")}`);
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
