import { describe, expect, it } from "bun:test";

import { consoleExporter, InMemoryObservability, type RecordedEvent } from "./index.ts";

describe("InMemoryObservability", () => {
  it("records spans with duration and attrs", async () => {
    const obs = new InMemoryObservability();
    const span = obs.trace("tts.chunk", { chunkId: "c-0" });
    span.setAttribute("bytes", 1024);
    await new Promise((r) => setTimeout(r, 10));
    span.end();

    const { records } = obs.snapshot();
    const spanRecord = records.find((r) => r.kind === "span");
    expect(spanRecord).toBeDefined();
    if (spanRecord?.kind === "span") {
      expect(spanRecord.name).toBe("tts.chunk");
      expect(spanRecord.attrs).toEqual({ chunkId: "c-0", bytes: 1024 });
      expect(spanRecord.durationMs).toBeGreaterThanOrEqual(5);
    }
  });

  it("guardDupSend returns false on first sight, true within window", () => {
    const obs = new InMemoryObservability({ dupWindowMs: 1000 });
    expect(obs.guardDupSend("hello")).toBe(false);
    expect(obs.guardDupSend("hello")).toBe(true);
    expect(obs.guardDupSend("world")).toBe(false);
  });

  it("guardDupSend resets after window elapses", async () => {
    const obs = new InMemoryObservability({ dupWindowMs: 50 });
    expect(obs.guardDupSend("x")).toBe(false);
    await new Promise((r) => setTimeout(r, 80));
    expect(obs.guardDupSend("x")).toBe(false);
  });

  it("recordReconnect increments total and emits event", () => {
    const obs = new InMemoryObservability();
    obs.recordReconnect(1);
    obs.recordReconnect(2);
    const snap = obs.snapshot();
    expect(snap.reconnectTotal).toBe(2);
    const reconnectEvents = snap.records.filter((r) => r.kind === "reconnect");
    expect(reconnectEvents).toHaveLength(2);
  });

  it("onRecord fires on every event type", () => {
    const obs = new InMemoryObservability();
    const events: RecordedEvent[] = [];
    obs.onRecord((e) => {
      events.push(e);
    });
    obs.trace("a").end();
    obs.guardDupSend("k");
    obs.recordReconnect(1);
    expect(events.map((e) => e.kind)).toEqual(["span", "dup_send", "reconnect"]);
  });

  it("onRecord unsubscribe stops further events", () => {
    const obs = new InMemoryObservability();
    const events: RecordedEvent[] = [];
    const unsub = obs.onRecord((e) => {
      events.push(e);
    });
    obs.recordReconnect(1);
    unsub();
    obs.recordReconnect(2);
    expect(events).toHaveLength(1);
  });

  it("drops oldest records on overflow", () => {
    const obs = new InMemoryObservability({ maxRecords: 3 });
    for (let i = 0; i < 5; i++) obs.recordReconnect(i);
    const { records } = obs.snapshot();
    expect(records).toHaveLength(3);
    if (records[0]?.kind === "reconnect") expect(records[0].attempt).toBe(2);
  });

  it("consoleExporter does not throw on any event shape", () => {
    // Smoke-test the exporter against one of each event.
    expect(() => {
      consoleExporter({ kind: "span", name: "n", attrs: {}, durationMs: 1, endedAt: 0 });
      consoleExporter({ kind: "dup_send", key: "k", seenAgain: false, at: 0 });
      consoleExporter({ kind: "reconnect", attempt: 1, at: 0 });
    }).not.toThrow();
  });
});
