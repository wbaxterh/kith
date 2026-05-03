/**
 * Expression state machine for avatar rendering.
 *
 * Manages smooth transitions between expression states (idle, speaking,
 * listening, thinking, emotion) with configurable blend durations. Consumers
 * feed KithEvents in and read the current expression state out for rendering.
 *
 * Usage:
 *   const expr = new ExpressionState();
 *   voice.on(event => expr.handleEvent(event));
 *
 *   // In render loop:
 *   const state = expr.current();
 *   vrm.expressionManager.setValue("happy", state.expressions.happy);
 */

import type { KithEvent } from "@kithjs/core";

export interface ExpressionSnapshot {
  /** Current high-level state */
  state: "idle" | "listening" | "thinking" | "speaking";
  /** Blend weights for VRM expressions (0-1) */
  expressions: Record<string, number>;
  /** Current emotion (from emotion_state events) */
  emotion: string;
  /** Emotion intensity (0-1) */
  emotionIntensity: number;
  /** Timestamp of the snapshot */
  timestamp: number;
}

export interface ExpressionStateOptions {
  /** Transition blend duration in ms. Default: 300 */
  transitionMs?: number;
  /** Default idle expressions */
  idleExpressions?: Record<string, number>;
}

/** Default expression presets for each state */
const STATE_EXPRESSIONS: Record<string, Record<string, number>> = {
  idle: { happy: 0.08, blink: 0 },
  listening: { happy: 0.16, ih: 0 },
  thinking: { ih: 0.1, happy: 0 },
  speaking: { happy: 0.22, aa: 0 },
};

/** Emotion-to-expression overrides */
const EMOTION_EXPRESSIONS: Record<string, Record<string, number>> = {
  excited: { happy: 0.6, ee: 0.1 },
  happy: { happy: 0.5 },
  calm: { happy: 0.15, relaxed: 0.3 },
  sad: { happy: 0, sad: 0.4 },
  angry: { angry: 0.5, happy: 0 },
  surprised: { surprised: 0.5, happy: 0.1 },
  neutral: {},
};

export class ExpressionState {
  private _state: "idle" | "listening" | "thinking" | "speaking" = "idle";
  private _emotion = "neutral";
  private _emotionIntensity = 0;
  private _expressions: Record<string, number> = {};
  private _targetExpressions: Record<string, number> = {};
  private _transitionMs: number;
  private _lastTransitionAt = 0;
  private _idleExpressions: Record<string, number>;

  constructor(options: ExpressionStateOptions = {}) {
    this._transitionMs = options.transitionMs ?? 300;
    this._idleExpressions = options.idleExpressions ?? STATE_EXPRESSIONS.idle;
    this._expressions = { ...this._idleExpressions };
    this._targetExpressions = { ...this._idleExpressions };
  }

  /** Feed a KithEvent into the state machine. */
  handleEvent(event: KithEvent): void {
    switch (event.type) {
      case "turn_start":
        this.transition(event.role === "user" ? "listening" : "speaking");
        break;
      case "turn_end":
        this.transition("idle");
        break;
      case "tts_start":
        this.transition("speaking");
        break;
      case "emotion_state":
        this._emotion = event.state;
        this._emotionIntensity = event.intensity;
        this.applyEmotion();
        break;
      default:
        break;
    }
  }

  /** Manually set the state (e.g., "thinking" while waiting for LLM). */
  setState(state: "idle" | "listening" | "thinking" | "speaking"): void {
    this.transition(state);
  }

  /**
   * Get the current expression snapshot. Call this in your render loop.
   * Interpolates between previous and target expressions based on elapsed time.
   */
  current(): ExpressionSnapshot {
    const now = Date.now();
    const elapsed = now - this._lastTransitionAt;
    const t = Math.min(1, elapsed / this._transitionMs);

    // Lerp between current and target
    const blended: Record<string, number> = {};
    const allKeys = new Set([
      ...Object.keys(this._expressions),
      ...Object.keys(this._targetExpressions),
    ]);

    for (const key of allKeys) {
      const from = this._expressions[key] ?? 0;
      const to = this._targetExpressions[key] ?? 0;
      const value = from + (to - from) * t;
      if (value > 0.001) {
        blended[key] = value;
      }
    }

    // Snap to target once transition is complete
    if (t >= 1) {
      this._expressions = { ...this._targetExpressions };
    }

    return {
      state: this._state,
      expressions: blended,
      emotion: this._emotion,
      emotionIntensity: this._emotionIntensity,
      timestamp: now,
    };
  }

  private transition(state: "idle" | "listening" | "thinking" | "speaking"): void {
    if (this._state === state) return;
    this._state = state;
    this._expressions = { ...this._targetExpressions }; // freeze current
    this._targetExpressions = {
      ...(STATE_EXPRESSIONS[state] || STATE_EXPRESSIONS.idle),
    };
    this.applyEmotion();
    this._lastTransitionAt = Date.now();
  }

  private applyEmotion(): void {
    const emotionExprs = EMOTION_EXPRESSIONS[this._emotion] ?? {};
    for (const [key, value] of Object.entries(emotionExprs)) {
      this._targetExpressions[key] =
        (this._targetExpressions[key] ?? 0) +
        value * this._emotionIntensity;
    }
  }
}
