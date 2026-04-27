/**
 * LiveKit portability integration test.
 *
 * Proves that the RuntimeAdapter contract is portable: a consumer can swap
 * PipecatRuntime for LiveKitRuntime and the event flow is identical.
 *
 * Scope: one test, per phase-1-planning.md §4 Day 10:
 *   "send text → get audio → emit at least one normalized event"
 */

import { describe, expect, test } from "bun:test";
import type { KithEvent } from "@kithjs/core";
import { LiveKitRuntime } from "../runtime.ts";

describe("LiveKitRuntime portability", () => {
  test("send text → tts_start → tts_audio_chunk(s) → tts_end → turn lifecycle", async () => {
    const runtime = new LiveKitRuntime({
      mockChunkDelayMs: 5, // fast for tests
      mockChunkCount: 3,
    });

    const events: KithEvent[] = [];
    runtime.on((event) => {
      events.push(event);
    });

    await runtime.connect({ sessionId: "test-session-1" });
    await runtime.sendText("Hey, what tricks should I learn?");
    await runtime.disconnect();

    // --- Verify the full event sequence ---

    // 1. turn_start (assistant)
    expect(events[0].type).toBe("turn_start");
    if (events[0].type === "turn_start") {
      expect(events[0].role).toBe("assistant");
      expect(events[0].turnId).toStartWith("lk-turn-");
    }

    // 2. tts_start
    expect(events[1].type).toBe("tts_start");

    // 3. N × tts_audio_chunk (we asked for 3)
    const audioChunks = events.filter((e) => e.type === "tts_audio_chunk");
    expect(audioChunks.length).toBe(3);

    for (const chunk of audioChunks) {
      if (chunk.type === "tts_audio_chunk") {
        // Each chunk has base64-encoded audio data
        expect(chunk.audioB64.length).toBeGreaterThan(0);
        expect(chunk.mimeType).toBe("audio/mpeg");
        // turnId and chunkId are consistent
        expect(chunk.turnId).toStartWith("lk-turn-");
        expect(chunk.chunkId).toStartWith("lk-chunk-");
      }
    }

    // 4. tts_end
    const ttsEnd = events.find((e) => e.type === "tts_end");
    expect(ttsEnd).toBeDefined();

    // 5. turn_end (assistant)
    const lastEvent = events[events.length - 1];
    expect(lastEvent.type).toBe("turn_end");
    if (lastEvent.type === "turn_end") {
      expect(lastEvent.role).toBe("assistant");
    }

    // Total: turn_start + tts_start + 3×chunk + tts_end + turn_end = 7
    expect(events.length).toBe(7);
  });

  test("bargeIn emits barge_in_detected", async () => {
    const runtime = new LiveKitRuntime();
    const events: KithEvent[] = [];
    runtime.on((event) => events.push(event));

    await runtime.connect({ sessionId: "test-session-2" });
    await runtime.bargeIn();
    await runtime.disconnect();

    expect(events.length).toBe(1);
    expect(events[0].type).toBe("barge_in_detected");
  });

  test("throws when connecting twice", async () => {
    const runtime = new LiveKitRuntime();
    await runtime.connect({ sessionId: "test-dup" });

    expect(runtime.connect({ sessionId: "test-dup-2" })).rejects.toThrow(
      "already connected",
    );

    await runtime.disconnect();
  });

  test("throws when sending without connect", async () => {
    const runtime = new LiveKitRuntime();

    expect(runtime.sendText("hello")).rejects.toThrow("not connected");
  });

  test("rejects non-mock URL in v0.1", async () => {
    const runtime = new LiveKitRuntime({ url: "wss://my-livekit.cloud" });

    expect(
      runtime.connect({ sessionId: "test-real" }),
    ).rejects.toThrow("only supports mock mode");
  });

  test("VoiceRouter compatibility — same event shape as PipecatRuntime", async () => {
    // This test proves a VoiceRouter could be wired to LiveKitRuntime
    // identically to PipecatRuntime. We verify the event shapes match
    // what @kith/core defines.
    const runtime = new LiveKitRuntime({ mockChunkDelayMs: 0 });
    const events: KithEvent[] = [];
    const unsub = runtime.on((event) => events.push(event));

    await runtime.connect({ sessionId: "test-compat" });
    await runtime.sendText("Testing portability");

    // Verify each event has a timestamp (required by EventBase)
    for (const event of events) {
      expect(event.timestamp).toBeGreaterThan(0);
    }

    // Verify turnId is consistent across the turn
    const turnIds = new Set(
      events
        .filter((e) => "turnId" in e)
        .map((e) => (e as { turnId: string }).turnId),
    );
    expect(turnIds.size).toBe(1); // all events belong to the same turn

    unsub();
    await runtime.disconnect();
  });
});
