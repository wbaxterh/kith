---
sidebar_position: 5
---

# @kithjs/observability

[![npm](https://img.shields.io/npm/v/@kithjs/observability)](https://www.npmjs.com/package/@kithjs/observability)

Traces, duplicate-send guards, and reconnect metrics. Diagnoses the most common production voice failures.

## Install

```bash
bun add @kithjs/core @kithjs/observability
```

## Usage

```ts
import { InMemoryObservability, consoleExporter } from "@kithjs/observability";

const obs = new InMemoryObservability();
obs.onRecord(consoleExporter); // log to console in dev

// Pass to runtime
const runtime = new PipecatRuntime({
  observability: obs,
  // ...
});
```

## Features

### Span Tracing

```ts
const span = obs.trace("tts_request", { voiceId: "abc", text: "hello" });
// ... do work ...
span.setAttribute("audioBytes", 4096);
span.end(); // records duration
```

### Duplicate-Send Guard

Prevents the same text from being sent twice within a sliding window:

```ts
if (obs.guardDupSend("hello-world")) {
  // Already sent recently — skip
  return;
}
// Safe to send
```

### Reconnect Tracking

```ts
obs.recordReconnect(1); // attempt #1
obs.recordReconnect(2); // attempt #2
```

### Custom Exporters

```ts
obs.onRecord((record) => {
  // Send to your telemetry service
  myTelemetry.send(record);
});
```
