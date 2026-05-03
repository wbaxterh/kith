/**
 * @kith/runtime-livekit — LiveKit RuntimeAdapter for Kith.
 *
 * v0.1 ships a mock-mode adapter that proves the RuntimeAdapter contract is
 * portable across runtimes. Real LiveKit WebRTC integration → v0.2.
 *
 * See `docs/phase-1-planning.md` §4 Week 2 for details.
 */

export { LiveKitRuntime, type LiveKitRuntimeOptions } from "./runtime.ts";
export { checkRNGlobals, createRNLiveKitRuntime, type RNLiveKitOptions } from "./react-native.ts";
