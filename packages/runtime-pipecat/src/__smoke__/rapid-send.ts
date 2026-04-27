/**
 * Regression: two rapid sendText calls must both complete. Earlier the Python
 * pipeline cancelled in-flight synthesis on every handle_text (interrupt
 * semantics), so voice-router's sentence-by-sentence forwarding produced
 * only the last utterance.
 */

import path from "node:path";
import type { KithEvent } from "@kithjs/core";

import { PipecatRuntime } from "../runtime.ts";

const HERE = path.dirname(Bun.fileURLToPath(import.meta.url));
const PYTHON_VENV = path.resolve(HERE, "../../python/.venv/bin/python");
const PYTHON_CWD = path.resolve(HERE, "../../python");

async function main(): Promise<void> {
  const received: KithEvent[] = [];
  const runtime = new PipecatRuntime({
    pythonPath: PYTHON_VENV,
    cwd: PYTHON_CWD,
    config: { pipeline: "mock" },
  });

  runtime.on((e) => {
    received.push(e);
    console.log(`[${e.type}]`, "turnId" in e ? e.turnId : "");
  });

  await runtime.connect({ sessionId: "rapid-send-smoke" });

  // Fire two sendText calls back-to-back — no await between.
  await runtime.sendText("First utterance.");
  await runtime.sendText("Second utterance.");

  // Wait long enough for both to complete.
  await new Promise((r) => setTimeout(r, 4000));
  await runtime.disconnect();

  const turnStarts = received.filter((e) => e.type === "turn_start");
  const turnEnds = received.filter((e) => e.type === "turn_end");
  console.log(`\nturn_starts=${turnStarts.length} turn_ends=${turnEnds.length}`);

  if (turnStarts.length !== 2 || turnEnds.length !== 2) {
    console.error(
      `FAIL: expected 2 turn_start + 2 turn_end, got ${turnStarts.length}/${turnEnds.length}`,
    );
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
