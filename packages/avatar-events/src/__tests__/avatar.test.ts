import { describe, expect, test } from "bun:test";
import type { KithEvent } from "@kithjs/core";
import {
  ExpressionState,
  blendShapeNames,
  mapVisemeToBlendShape,
  supportedVisemes,
} from "../index.ts";

describe("viseme mapping", () => {
  test("maps known visemes to blend shapes", () => {
    const aa = mapVisemeToBlendShape("aa");
    expect(aa.name).toBe("aa");
    expect(aa.scale).toBe(1.0);

    const pp = mapVisemeToBlendShape("pp");
    expect(pp.name).toBe("ou");
    expect(pp.scale).toBeLessThan(1.0);

    const sil = mapVisemeToBlendShape("sil");
    expect(sil.name).toBe("neutral");
    expect(sil.scale).toBe(0);
  });

  test("returns neutral for unknown visemes", () => {
    const unknown = mapVisemeToBlendShape("xyz");
    expect(unknown.name).toBe("neutral");
    expect(unknown.scale).toBe(0);
  });

  test("is case-insensitive", () => {
    const upper = mapVisemeToBlendShape("AA");
    expect(upper.name).toBe("aa");
  });

  test("supportedVisemes returns all viseme labels", () => {
    const visemes = supportedVisemes();
    expect(visemes.length).toBeGreaterThan(10);
    expect(visemes).toContain("aa");
    expect(visemes).toContain("sil");
    expect(visemes).toContain("pp");
  });

  test("blendShapeNames returns unique VRM expression names", () => {
    const names = blendShapeNames();
    expect(names).toContain("aa");
    expect(names).toContain("ee");
    expect(names).toContain("ou");
    expect(names).toContain("neutral");
    // Should be unique
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("ExpressionState", () => {
  test("starts in idle state", () => {
    const expr = new ExpressionState();
    const snap = expr.current();
    expect(snap.state).toBe("idle");
    expect(snap.emotion).toBe("neutral");
  });

  test("transitions on turn_start events", () => {
    const expr = new ExpressionState({ transitionMs: 0 });

    expr.handleEvent({
      type: "turn_start",
      timestamp: Date.now(),
      turnId: "t1",
      role: "assistant",
    } as KithEvent);

    const snap = expr.current();
    expect(snap.state).toBe("speaking");
  });

  test("transitions to listening on user turn", () => {
    const expr = new ExpressionState({ transitionMs: 0 });

    expr.handleEvent({
      type: "turn_start",
      timestamp: Date.now(),
      turnId: "t1",
      role: "user",
    } as KithEvent);

    expect(expr.current().state).toBe("listening");
  });

  test("returns to idle on turn_end", () => {
    const expr = new ExpressionState({ transitionMs: 0 });

    expr.handleEvent({
      type: "turn_start",
      timestamp: Date.now(),
      turnId: "t1",
      role: "assistant",
    } as KithEvent);
    expect(expr.current().state).toBe("speaking");

    expr.handleEvent({
      type: "turn_end",
      timestamp: Date.now(),
      turnId: "t1",
      role: "assistant",
    } as KithEvent);
    expect(expr.current().state).toBe("idle");
  });

  test("captures emotion from emotion_state events", () => {
    const expr = new ExpressionState({ transitionMs: 0 });

    expr.handleEvent({
      type: "emotion_state",
      timestamp: Date.now(),
      state: "excited",
      intensity: 0.8,
    } as KithEvent);

    const snap = expr.current();
    expect(snap.emotion).toBe("excited");
    expect(snap.emotionIntensity).toBe(0.8);
    expect(snap.expressions.happy).toBeGreaterThan(0);
  });

  test("setState allows manual state control", () => {
    const expr = new ExpressionState({ transitionMs: 0 });
    expr.setState("thinking");
    expect(expr.current().state).toBe("thinking");
  });

  test("expressions have positive values", () => {
    const expr = new ExpressionState({ transitionMs: 0 });
    const snap = expr.current();
    for (const val of Object.values(snap.expressions)) {
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });
});
