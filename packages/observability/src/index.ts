/**
 * @kith/observability — in-memory implementation of the ObservabilityAdapter
 * contract.
 *
 * Covers the minimum we ship for v0.1:
 *   - `trace(name, attrs)` opens a named span; consumer calls `.end()`.
 *   - `guardDupSend(key)` returns true if the key was seen within the
 *     sliding window. Lets higher layers skip a duplicate send without
 *     each implementing its own map.
 *   - `recordReconnect(attempt)` counts + timestamps runtime reconnects.
 *
 * All state is in-process. For OpenTelemetry or external export, subscribe
 * via `onRecord(handler)` — every finished span, reconnect, and dup-send
 * decision is emitted as a `RecordedEvent` you can forward.
 */

import type { ObservabilityAdapter, Span } from "@kithjs/core";

export type RecordedEvent =
  | {
      kind: "span";
      name: string;
      attrs: Record<string, unknown>;
      durationMs: number;
      endedAt: number;
    }
  | { kind: "dup_send"; key: string; seenAgain: boolean; at: number }
  | { kind: "reconnect"; attempt: number; at: number };

export type RecordHandler = (event: RecordedEvent) => void;

export interface InMemoryObservabilityOptions {
  /** Sliding-window length (ms) for guardDupSend. Default: 5000. */
  dupWindowMs?: number;
  /** Soft cap on retained finished spans + events. Default: 1000. Older
   * records are dropped on overflow. */
  maxRecords?: number;
}

interface ActiveSpan extends Span {
  readonly name: string;
  readonly startedAt: number;
  readonly attrs: Record<string, unknown>;
}

export class InMemoryObservability implements ObservabilityAdapter {
  private readonly dupWindowMs: number;
  private readonly maxRecords: number;
  private readonly dupMap = new Map<string, number>();
  private readonly records: RecordedEvent[] = [];
  private readonly handlers = new Set<RecordHandler>();
  private reconnectTotal = 0;

  constructor(options: InMemoryObservabilityOptions = {}) {
    this.dupWindowMs = options.dupWindowMs ?? 5000;
    this.maxRecords = options.maxRecords ?? 1000;
  }

  trace(name: string, attrs: Record<string, unknown> = {}): Span {
    const startedAt = Date.now();
    const spanAttrs: Record<string, unknown> = { ...attrs };
    const self = this;

    const span: ActiveSpan = {
      name,
      startedAt,
      attrs: spanAttrs,
      setAttribute(key, value) {
        spanAttrs[key] = value;
      },
      end() {
        const endedAt = Date.now();
        self.push({
          kind: "span",
          name,
          attrs: spanAttrs,
          durationMs: endedAt - startedAt,
          endedAt,
        });
      },
    };
    return span;
  }

  guardDupSend(key: string): boolean {
    const now = Date.now();
    this.prune(now);
    const prev = this.dupMap.get(key);
    const seenAgain = prev !== undefined && now - prev < this.dupWindowMs;
    this.dupMap.set(key, now);
    this.push({ kind: "dup_send", key, seenAgain, at: now });
    return seenAgain;
  }

  recordReconnect(attempt: number): void {
    this.reconnectTotal += 1;
    this.push({ kind: "reconnect", attempt, at: Date.now() });
  }

  /** Subscribe to every recorded event (for OTel bridges, dashboards, tests). */
  onRecord(handler: RecordHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /** Snapshot of retained records. */
  snapshot(): {
    records: RecordedEvent[];
    reconnectTotal: number;
    dupWindowMs: number;
  } {
    return {
      records: [...this.records],
      reconnectTotal: this.reconnectTotal,
      dupWindowMs: this.dupWindowMs,
    };
  }

  private push(event: RecordedEvent): void {
    this.records.push(event);
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords);
    }
    for (const h of this.handlers) {
      try {
        h(event);
      } catch (err) {
        console.error("kith: observability handler threw", err);
      }
    }
  }

  private prune(now: number): void {
    const cutoff = now - this.dupWindowMs;
    for (const [key, at] of this.dupMap) {
      if (at < cutoff) this.dupMap.delete(key);
    }
  }
}

/**
 * Console exporter — forwards every recorded event to `console.log`.
 * Useful in dev; noisy in prod. Attach via `obs.onRecord(consoleExporter)`.
 */
export const consoleExporter: RecordHandler = (event) => {
  if (event.kind === "span") {
    console.log(`[trace] ${event.name} (${event.durationMs}ms)`, event.attrs);
  } else if (event.kind === "dup_send") {
    console.log(`[dup_send] key=${event.key} seen_again=${event.seenAgain}`);
  } else {
    console.log(`[reconnect] attempt=${event.attempt}`);
  }
};
