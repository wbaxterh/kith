/**
 * ProceduralAnimator — production-ready VRM animation for AI companions.
 *
 * Encapsulates all the hard-won learnings from the Kaori VRM integration:
 * - Correct bone rotation directions for VRM 1.0
 * - Smooth damping for glitch-free transitions
 * - Pose-based gesture system (not continuous sine waves)
 * - Natural blinking, breathing, and idle motion
 * - Simulated lip sync for WebSocket audio mode
 * - Finger curl for relaxed hands
 *
 * Usage:
 *   import { ProceduralAnimator } from "@kithjs/avatar-events";
 *
 *   const animator = new ProceduralAnimator();
 *   // In your Three.js animate loop:
 *   animator.update(vrm, dt, t, charState); // "idle" | "speaking" | "listening" | "thinking"
 *
 * IMPORTANT: Do NOT use a THREE.AnimationMixer alongside this animator.
 * Mixamo FBX clips override all bone rotations and will cause T-pose.
 */

export interface AnimatorOptions {
  /** Damping factor for smooth transitions. Lower = smoother. Default: 2.5 */
  damping?: number;
  /** Blink interval in seconds. Default: 3.5 */
  blinkInterval?: number;
  /** Blink duration in seconds. Default: 0.15 */
  blinkDuration?: number;
  /** Target height for auto-scaling the model. Default: 1.8 */
  targetHeight?: number;
  /** Camera Y position. Default: 1.25 */
  cameraY?: number;
  /** Camera lookAt Y. Default: 1.2 */
  lookAtY?: number;
}

/** A single conversational gesture pose. */
export interface GesturePose {
  /** Left upper arm Z rotation (negative = down) */
  leftArmZ: number;
  /** Right upper arm Z rotation (positive = down) */
  rightArmZ: number;
  /** Left upper arm X rotation (positive = forward) */
  leftArmX: number;
  /** Right upper arm X rotation (positive = forward) */
  rightArmX: number;
  /** Left forearm Z rotation */
  leftForeZ: number;
  /** Right forearm Z rotation */
  rightForeZ: number;
  /** Left hand X rotation (wrist tilt) */
  leftHandX: number;
  /** Right hand X rotation (wrist tilt) */
  rightHandX: number;
  /** Neck X offset (nod) */
  neckX: number;
  /** Neck Y offset (turn) */
  neckY: number;
  /** Spine X offset (lean) */
  spineX: number;
}

/** Default gesture poses for natural conversation. */
export const DEFAULT_GESTURE_POSES: GesturePose[] = [
  // 0: Resting — arms at sides
  { leftArmZ: -1.15, rightArmZ: 1.2, leftArmX: 0.08, rightArmX: 0.05, leftForeZ: -0.15, rightForeZ: 0.15, leftHandX: 0.1, rightHandX: 0.1, neckX: 0, neckY: 0, spineX: 0 },
  // 1: Right hand explaining — palm up
  { leftArmZ: -1.1, rightArmZ: 0.7, leftArmX: 0.1, rightArmX: 0.4, leftForeZ: -0.15, rightForeZ: -0.3, leftHandX: 0.1, rightHandX: -0.3, neckX: 0.03, neckY: -0.04, spineX: 0.02 },
  // 2: Left hand presenting — open palm
  { leftArmZ: -0.7, rightArmZ: 1.15, leftArmX: 0.4, rightArmX: 0.08, leftForeZ: 0.3, rightForeZ: 0.15, leftHandX: -0.3, rightHandX: 0.1, neckX: 0.02, neckY: 0.05, spineX: 0.01 },
  // 3: Both hands emphasis — open palms forward
  { leftArmZ: -0.85, rightArmZ: 0.85, leftArmX: 0.35, rightArmX: 0.35, leftForeZ: 0.1, rightForeZ: -0.1, leftHandX: -0.2, rightHandX: -0.2, neckX: 0.04, neckY: 0, spineX: 0.02 },
  // 4: Right hand counting/listing
  { leftArmZ: -1.1, rightArmZ: 0.6, leftArmX: 0.1, rightArmX: 0.5, leftForeZ: -0.15, rightForeZ: -0.45, leftHandX: 0.1, rightHandX: -0.15, neckX: 0.02, neckY: -0.06, spineX: 0.015 },
  // 5: Nodding emphasis — subtle forward
  { leftArmZ: -1.0, rightArmZ: 1.0, leftArmX: 0.2, rightArmX: 0.2, leftForeZ: -0.1, rightForeZ: 0.1, leftHandX: 0, rightHandX: 0, neckX: 0.05, neckY: 0.02, spineX: 0.015 },
];

/**
 * Get the correct bone node from a VRM humanoid, or null.
 * Works with both VRM 0.x and 1.x.
 */
function getBone(vrm: any, name: string): any {
  return vrm?.humanoid?.getNormalizedBoneNode?.(name) ?? null;
}

/**
 * THREE.MathUtils.damp equivalent for environments where THREE isn't imported.
 * Exponential decay interpolation: current → target at rate `lambda` over `dt`.
 */
function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export class ProceduralAnimator {
  private options: Required<AnimatorOptions>;
  private gesturePoses: GesturePose[];

  constructor(
    options?: AnimatorOptions,
    gesturePoses?: GesturePose[],
  ) {
    this.options = {
      damping: options?.damping ?? 2.5,
      blinkInterval: options?.blinkInterval ?? 3.5,
      blinkDuration: options?.blinkDuration ?? 0.15,
      targetHeight: options?.targetHeight ?? 1.8,
      cameraY: options?.cameraY ?? 1.25,
      lookAtY: options?.lookAtY ?? 1.2,
    };
    this.gesturePoses = gesturePoses ?? DEFAULT_GESTURE_POSES;
  }

  /**
   * Update the VRM model's bones for the current frame.
   *
   * Call this in your Three.js animate loop INSTEAD of using an AnimationMixer.
   *
   * @param vrm - The loaded VRM model (from @pixiv/three-vrm)
   * @param dt - Delta time from THREE.Clock.getDelta()
   * @param t - Elapsed time from THREE.Clock.elapsedTime
   * @param state - Current character state
   */
  update(
    vrm: any,
    dt: number,
    t: number,
    state: "idle" | "speaking" | "listening" | "thinking",
  ): void {
    if (!vrm?.humanoid) return;

    const d = this.options.damping;
    const isSpeaking = state === "speaking";

    // --- Core bones ---
    const hips = getBone(vrm, "hips");
    const spine = getBone(vrm, "spine");
    const chest = getBone(vrm, "chest");
    const neck = getBone(vrm, "neck");
    const leftUpperArm = getBone(vrm, "leftUpperArm");
    const rightUpperArm = getBone(vrm, "rightUpperArm");
    const leftForeArm = getBone(vrm, "leftLowerArm");
    const rightForeArm = getBone(vrm, "rightLowerArm");
    const leftHand = getBone(vrm, "leftHand");
    const rightHand = getBone(vrm, "rightHand");

    // --- Breathing + idle ---
    const breathe = Math.sin(t * 1.2) * 0.015;
    const idleSway = Math.sin(t * 0.4) * 0.02;
    const headDrift = Math.sin(t * 0.55) * 0.04;
    const breathSway = Math.sin(t * 0.5) * 0.015;

    if (hips) {
      hips.rotation.z = damp(hips.rotation.z, Math.sin(t * 0.3) * 0.015, d, dt);
      hips.rotation.y = damp(hips.rotation.y, Math.sin(t * 0.2) * 0.01, d, dt);
    }
    if (neck) {
      neck.rotation.y = damp(neck.rotation.y, headDrift, d, dt);
      neck.rotation.x = damp(neck.rotation.x, breathe * 0.8, d, dt);
      neck.rotation.z = damp(neck.rotation.z, Math.sin(t * 0.35) * 0.02, d, dt);
    }
    if (spine) {
      spine.rotation.z = damp(spine.rotation.z, idleSway, d, dt);
      spine.rotation.x = damp(spine.rotation.x, breathe * 0.4, d, dt);
    }
    if (chest) {
      chest.rotation.x = damp(chest.rotation.x, breathe * 0.6, d, dt);
    }

    // State-specific body adjustments
    if (state === "listening" && neck) {
      neck.rotation.x = damp(neck.rotation.x, neck.rotation.x + 0.08, d, dt);
    }
    if (state === "thinking" && neck) {
      neck.rotation.y = damp(neck.rotation.y, neck.rotation.y + Math.sin(t * 2.2) * 0.05, d, dt);
    }

    // --- Gesture pose system ---
    const idlePose = this.gesturePoses[0];
    const poseInterval = 2.0;
    const poseIdx = isSpeaking
      ? 1 + (Math.floor(t / poseInterval) % (this.gesturePoses.length - 1))
      : 0;
    const pose = isSpeaking ? this.gesturePoses[poseIdx] : idlePose;

    if (leftUpperArm) {
      leftUpperArm.rotation.z = damp(leftUpperArm.rotation.z, pose.leftArmZ + breathSway, d, dt);
      leftUpperArm.rotation.x = damp(leftUpperArm.rotation.x, pose.leftArmX, d, dt);
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.z = damp(rightUpperArm.rotation.z, pose.rightArmZ - breathSway, d, dt);
      rightUpperArm.rotation.x = damp(rightUpperArm.rotation.x, pose.rightArmX, d, dt);
    }
    if (leftForeArm) {
      leftForeArm.rotation.z = damp(leftForeArm.rotation.z, pose.leftForeZ, d, dt);
    }
    if (rightForeArm) {
      rightForeArm.rotation.z = damp(rightForeArm.rotation.z, pose.rightForeZ, d, dt);
    }
    if (leftHand) {
      leftHand.rotation.x = damp(leftHand.rotation.x, pose.leftHandX, d, dt);
    }
    if (rightHand) {
      rightHand.rotation.x = damp(rightHand.rotation.x, pose.rightHandX, d, dt);
    }

    // Head from pose
    if (neck) {
      neck.rotation.x += pose.neckX;
      neck.rotation.y += pose.neckY;
    }
    if (isSpeaking && spine) {
      spine.rotation.x += pose.spineX;
    }

    // --- Finger curl ---
    for (const side of ["left", "right"] as const) {
      for (const finger of ["Thumb", "Index", "Middle", "Ring", "Little"]) {
        for (const joint of ["Proximal", "Intermediate", "Distal"]) {
          const bone = getBone(vrm, `${side}${finger}${joint}`);
          if (!bone) continue;
          const amount = joint === "Proximal" ? 0.3 : joint === "Intermediate" ? 0.35 : 0.25;
          const curl = side === "left" ? -amount : amount;
          bone.rotation.z = damp(bone.rotation.z, curl, d, dt);
        }
      }
    }

    // --- Expressions ---
    const em = vrm.expressionManager;
    if (!em) return;

    const setExpr = (name: string, value: number) => {
      try { em.setValue(name, value); } catch { /* unsupported expression */ }
    };

    // Blinking
    const blinkT = t % this.options.blinkInterval;
    const blinkVal = blinkT < this.options.blinkDuration
      ? Math.sin((blinkT / this.options.blinkDuration) * Math.PI)
      : 0;
    setExpr("blink", blinkVal);

    // Mouth (simulated lip sync when speaking)
    if (isSpeaking) {
      setExpr("aa", Math.max(0, Math.sin(t * 5.5)) * 0.5);
      setExpr("oh", Math.max(0, Math.sin(t * 4.2 + 1.2)) * 0.35);
      setExpr("ee", Math.max(0, Math.sin(t * 6.8 + 2.5)) * 0.3);
    } else {
      setExpr("aa", 0);
      setExpr("oh", 0);
      setExpr("ee", 0);
    }

    // Resting smile
    const smile = state === "listening" ? 0.18 : isSpeaking ? 0.25 : 0.12;
    setExpr("happy", smile);

    // Update VRM internals
    vrm.update(dt);
  }
}
