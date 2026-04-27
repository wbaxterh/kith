/**
 * Reliability regression: kill the Python sidecar mid-session; PipecatRuntime
 * must emit `reconnect`, respawn, and keep working.
 *
 * Uses the mock pipeline so this doesn't hit any paid API.
 */

import path from "node:path";
import type { KithEvent } from "@kithjs/core";

import { PipecatRuntime } from "../runtime.ts";

const HERE = path.dirname(Bun.fileURLToPath(import.meta.url));
const PYTHON_VENV = path.resolve(HERE, "../../python/.venv/bin/python");
const PYTHON_CWD = path.resolve(HERE, "../../python");

async function main(): Promise<void> {
  const events: KithEvent[] = [];
  const runtime = new PipecatRuntime({
    pythonPath: PYTHON_VENV,
    cwd: PYTHON_CWD,
    config: { pipeline: "mock" },
    maxReconnectAttempts: 3,
  });

  const reconnectEvent = Promise.withResolvers<void>();

  runtime.on((e) => {
    events.push(e);
    if (e.type === "reconnect") {
      console.log(`[reconnect] attempt=${e.attempt}`);
      reconnectEvent.resolve();
    } else {
      console.log(`[${e.type}]`);
    }
  });

  await runtime.connect({ sessionId: "respawn-smoke" });
  console.log("\n→ initial sendText before killing sidecar");
  await runtime.sendText("First sentence.");
  await new Promise((r) => setTimeout(r, 800));

  // Kill the Python subprocess out from under the runtime.
  // @ts-expect-error — accessing private for the test; equivalent to SIGKILL from the OS.
  const proc = runtime.sidecar?.process;
  if (proc !== undefined && proc !== null) {
    console.log("\n→ killing sidecar (simulating crash)");
    proc.kill("SIGKILL");
  } else {
    console.error("FAIL: no sidecar to kill");
    process.exit(1);
  }

  await Promise.race([
    reconnectEvent.promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("no reconnect fired")), 10000)),
  ]);

  // After reconnect, the runtime should be usable again. Give it a moment
  // for the respawn + hello handshake to complete.
  await new Promise((r) => setTimeout(r, 2500));

  console.log("\n→ sendText after respawn");
  const postReconnectBefore = events.length;
  await runtime.sendText("Recovered.");
  await new Promise((r) => setTimeout(r, 1500));
  const postEvents = events.slice(postReconnectBefore);
  const gotTurn = postEvents.some((e) => e.type === "turn_start");

  await runtime.disconnect();

  if (!gotTurn) {
    console.error("FAIL: sendText after respawn produced no turn_start");
    process.exit(1);
  }

  const reconnectCount = events.filter((e) => e.type === "reconnect").length;
  console.log(`\nreconnect events: ${reconnectCount}`);
  if (reconnectCount === 0) {
    console.error("FAIL: no reconnect event emitted");
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
