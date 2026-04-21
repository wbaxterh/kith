/**
 * Sidecar subprocess manager.
 *
 * Spawns `python -m kith_runtime`, parses the `KITH_RUNTIME_READY port=…`
 * handshake line from stdout, and exposes the bound port for the WebSocket
 * client to connect to.
 */

import type { Subprocess } from "bun";

export interface SidecarOptions {
  /** Absolute path to a Python interpreter that has `kith_runtime` installed. */
  pythonPath?: string;
  /** Working directory for the sidecar. Defaults to the package's python/ folder. */
  cwd?: string;
  /** Extra env vars. Merged over `process.env`. */
  env?: Record<string, string>;
}

export interface SidecarHandle {
  port: number;
  process: Subprocess;
  /** Resolves when the process exits. */
  exited: Promise<number | null>;
}

const READY_PREFIX = "KITH_RUNTIME_READY port=";
const READY_TIMEOUT_MS = 10_000;

export async function spawnSidecar(options: SidecarOptions = {}): Promise<SidecarHandle> {
  const python = options.pythonPath ?? "python3";

  const spawnOptions: Parameters<typeof Bun.spawn>[1] = {
    env: { ...process.env, ...options.env },
    stdout: "pipe",
    stderr: "pipe",
  };
  if (options.cwd !== undefined) {
    spawnOptions.cwd = options.cwd;
  }

  const proc = Bun.spawn([python, "-m", "kith_runtime"], spawnOptions);

  const port = await readPortFromStdout(proc);
  return {
    port,
    process: proc,
    exited: proc.exited,
  };
}

async function readPortFromStdout(proc: Subprocess): Promise<number> {
  const stdout = proc.stdout;
  if (stdout === null || stdout === undefined || typeof stdout === "number") {
    throw new Error("sidecar stdout not piped");
  }

  const reader = (stdout as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const timeoutSignal = AbortSignal.timeout(READY_TIMEOUT_MS);

  while (true) {
    if (timeoutSignal.aborted) {
      proc.kill();
      throw new Error("sidecar did not emit ready line within 10s");
    }

    const { value, done } = await reader.read();
    if (done) throw new Error("sidecar stdout closed before ready line");
    buffer += decoder.decode(value, { stream: true });

    const newlineIdx = buffer.indexOf("\n");
    if (newlineIdx === -1) continue;

    const line = buffer.slice(0, newlineIdx).trim();
    buffer = buffer.slice(newlineIdx + 1);

    if (!line.startsWith(READY_PREFIX)) {
      // Informational output before the ready line is a protocol violation —
      // but we surface it loudly rather than silently forwarding.
      throw new Error(`sidecar emitted unexpected stdout before ready: ${line}`);
    }

    const port = Number(line.slice(READY_PREFIX.length));
    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(`sidecar emitted invalid port: ${line}`);
    }

    // Release the reader so downstream logging can keep reading stdout.
    reader.releaseLock();
    return port;
  }
}
