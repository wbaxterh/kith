/**
 * @kithjs/avatar-events — VRM avatar utilities for Kith.
 *
 * Phoneme-to-viseme mapping, expression state machine, and blend shape
 * helpers for rendering avatar expressions driven by KithEvents.
 */

export {
  type BlendShapeTarget,
  blendShapeNames,
  mapVisemeToBlendShape,
  supportedVisemes,
} from "./viseme-map.ts";

export {
  ExpressionState,
  type ExpressionSnapshot,
  type ExpressionStateOptions,
} from "./expression-state.ts";
