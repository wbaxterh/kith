/**
 * @kithjs/server — Standalone voice microservice for Kith.
 *
 * POST text, get streaming audio. Framework agnostic.
 *
 * Quick start:
 *   ELEVENLABS_API_KEY=sk_... bun @kithjs/server
 *
 * Or programmatic:
 *   import { KithServer } from "@kithjs/server";
 *   const server = new KithServer({ port: 3040 });
 *   await server.start();
 */

export { KithServer, type KithServerOptions } from "./server.ts";
export { SessionManager, type Session, type SessionConfig } from "./session.ts";
export { CharacterRegistry } from "./character-registry.ts";

// Auto-start when run directly
if (import.meta.main) {
  const { KithServer } = await import("./server.ts");
  const server = new KithServer();
  await server.start();
}
