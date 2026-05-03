/**
 * React Native helpers for LiveKitRuntime.
 *
 * LiveKit's @livekit/react-native SDK provides the WebRTC layer for mobile.
 * This module exports helpers for setting up the LiveKit runtime in an
 * Expo or bare React Native app.
 *
 * Usage:
 *   import { createRNLiveKitRuntime } from "@kithjs/runtime-livekit/react-native";
 *
 *   const runtime = createRNLiveKitRuntime({
 *     url: "wss://my-livekit.cloud",
 *     token: await getTokenFromBackend(),
 *   });
 *
 *   await runtime.connect({ sessionId: "mobile-user-123" });
 *   // ... use with VoiceRouter as normal
 */

import { LiveKitRuntime, type LiveKitRuntimeOptions } from "./runtime.ts";

export interface RNLiveKitOptions extends LiveKitRuntimeOptions {
  /**
   * Whether to request microphone permission on connect.
   * Default: true. Set to false if you handle permissions yourself.
   */
  requestMicPermission?: boolean;
}

/**
 * Create a LiveKitRuntime configured for React Native.
 *
 * Prerequisites:
 *   1. Install `@livekit/react-native` and `livekit-client`
 *   2. Call `registerGlobals()` from `@livekit/react-native` at app startup
 *   3. Add microphone permission to app.json / Info.plist / AndroidManifest.xml
 *
 * ```ts
 * // App.tsx (or index.js)
 * import { registerGlobals } from "@livekit/react-native";
 * registerGlobals();
 * ```
 */
export function createRNLiveKitRuntime(options: RNLiveKitOptions): LiveKitRuntime {
  if (!options.url || options.url === "mock") {
    // Mock mode works the same on RN as web
    return new LiveKitRuntime(options);
  }

  if (!options.token) {
    throw new Error(
      "createRNLiveKitRuntime requires a `token` for real mode. " +
        "Generate one server-side with livekit-server-sdk.",
    );
  }

  return new LiveKitRuntime(options);
}

/**
 * Check if the React Native LiveKit globals are registered.
 * Call this early in your app to catch setup issues.
 */
export function checkRNGlobals(): { ok: boolean; message: string } {
  if (typeof globalThis.RTCPeerConnection === "undefined") {
    return {
      ok: false,
      message:
        "RTCPeerConnection not found. Did you call registerGlobals() " +
        'from "@livekit/react-native" at app startup?',
    };
  }
  return { ok: true, message: "LiveKit RN globals registered" };
}
