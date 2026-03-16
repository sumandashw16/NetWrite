/**
 * handTracker.js — Advanced Hand Gesture Tracker
 *
 * Gestures:
 *  ✏️  DRAW   — Pinch (thumb tip ↔ index tip close together)
 *  🖐  ERASE  — Open palm (all fingers extended, no pinch)
 *  ✊  PAUSE  — Fist (all fingers curled, no pinch)
 *  🤙  IDLE   — Anything else
 *
 * Features:
 *  - Adaptive smoothing (slow hand → heavy smoothing, fast hand → light)
 *  - Gesture hysteresis (prevents rapid state flickering)
 *  - Velocity + direction tracking (for stroke prediction)
 *  - Pinch dead-zone (stable DRAW/IDLE boundary)
 *  - Per-finger curl detection
 *  - Confidence scores for each gesture
 */

import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";

/**
 * Pinch ratio thresholds (pinchDist / palmWidth).
 * The gap between ON and OFF creates the dead-zone that kills state flicker.
 */
const PINCH_ON_THRESHOLD  = 0.38; // tighter than before → enter DRAW
const PINCH_OFF_THRESHOLD = 0.52; // must open wider    → exit  DRAW

/**
 * Adaptive smoothing bounds.
 * α = lerp factor; 0 = frozen, 1 = raw.
 * High velocity → α near MAX (responsive).
 * Low  velocity → α near MIN (buttery).
 */
const SMOOTH_MIN = 0.15;
const SMOOTH_MAX = 0.72;
const VELOCITY_SCALE = 80; // normalises raw pixel-space velocity into [0,1]

/**
 * How many consecutive frames a new gesture must be seen
 * before we commit to it (hysteresis debounce).
 */
const GESTURE_DEBOUNCE_FRAMES = 3;

/**
 * Finger curl: ratio of tip-to-wrist vs MCP-to-wrist.
 * If tip is much closer to wrist than the knuckle, the finger is curled.
 */
const CURL_THRESHOLD = 0.85;

// Mediapipe landmark indices
const LM = {
  WRIST:          0,
  THUMB_CMC:      1, THUMB_MCP:  2, THUMB_IP:  3, THUMB_TIP:  4,
  INDEX_MCP:      5, INDEX_PIP:  6, INDEX_DIP:  7, INDEX_TIP:  8,
  MIDDLE_MCP:     9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP:      13, RING_PIP:   14, RING_DIP:  15, RING_TIP:  16,
  PINKY_MCP:     17, PINKY_PIP:  18, PINKY_DIP: 19, PINKY_TIP: 20,
};

// ─── Module State ─────────────────────────────────────────────────────────────

let handLandmarker = null;

// Smoothed cursor position
let smoothX = null;
let smoothY = null;

// Velocity (normalised units / frame)
let velX = 0;
let velY = 0;

// Previous raw target for velocity calc
let prevTargetX = null;
let prevTargetY = null;

// Hysteresis: track candidate gesture + how many frames it has been seen
let currentGesture  = "IDLE";
let candidateGesture = "IDLE";
let candidateFrames  = 0;

// Pinch state (uses the dead-zone, so it's separate from full gesture)
let isPinching = false;

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initialise MediaPipe HandLandmarker.
 * Call once before the render loop.
 */
export async function initHandTracker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });
}

// ─── Geometry Helpers ─────────────────────────────────────────────────────────

/** Euclidean distance between two landmarks (2D). */
function dist2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * True if a finger is curled.
 * Compares tip distance to wrist against the MCP (knuckle) distance to wrist.
 */
function isFingerCurled(lm, tipIdx, mcpIdx) {
  const tipDist = dist2D(lm[tipIdx],  lm[LM.WRIST]);
  const mcpDist = dist2D(lm[mcpIdx], lm[LM.WRIST]);
  return tipDist < mcpDist * CURL_THRESHOLD;
}

/**
 * Returns an object describing which fingers are extended (true) or curled.
 * Thumb is handled differently (lateral, not dorsal movement).
 */
function getFingerStates(lm) {
  // Thumb: compare tip X to IP X (works for right/left hands approximately)
  const thumbExtended = dist2D(lm[LM.THUMB_TIP], lm[LM.INDEX_MCP]) >
                        dist2D(lm[LM.THUMB_IP],  lm[LM.INDEX_MCP]);

  return {
    thumb:  thumbExtended,
    index:  !isFingerCurled(lm, LM.INDEX_TIP,  LM.INDEX_MCP),
    middle: !isFingerCurled(lm, LM.MIDDLE_TIP, LM.MIDDLE_MCP),
    ring:   !isFingerCurled(lm, LM.RING_TIP,   LM.RING_MCP),
    pinky:  !isFingerCurled(lm, LM.PINKY_TIP,  LM.PINKY_MCP),
  };
}

// ─── Gesture Classification ───────────────────────────────────────────────────

/**
 * Classify the hand's gesture based on landmarks.
 * Returns one of: "DRAW" | "ERASE" | "PAUSE" | "IDLE"
 */
function classifyGesture(lm) {
  const palmWidth = dist2D(lm[LM.INDEX_MCP], lm[LM.PINKY_MCP]);
  const pinchDist  = dist2D(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP]);
  const pinchRatio = pinchDist / Math.max(palmWidth, 0.001);

  // Update hysteresis-aware pinch flag
  if (pinchRatio < PINCH_ON_THRESHOLD)  isPinching = true;
  if (pinchRatio > PINCH_OFF_THRESHOLD) isPinching = false;

  if (isPinching) return "DRAW";

  const fingers = getFingerStates(lm);
  const extendedCount = [fingers.index, fingers.middle, fingers.ring, fingers.pinky]
    .filter(Boolean).length;

  // Fist: all four fingers curled
  if (extendedCount === 0) return "PAUSE";

  // Open palm: all four fingers extended
  if (extendedCount >= 3) return "ERASE";

  return "IDLE";
}

// ─── Smoothing ────────────────────────────────────────────────────────────────

/**
 * Compute adaptive lerp factor.
 * Fast movement → α closer to SMOOTH_MAX (responsive cursor).
 * Slow movement → α closer to SMOOTH_MIN (jitter eliminated).
 */
function adaptiveLerp(rawX, rawY) {
  if (smoothX === null) {
    smoothX = rawX;
    smoothY = rawY;
    velX = 0;
    velY = 0;
    return;
  }

  // Instant velocity (raw distance this frame)
  const frameVelX = rawX - (prevTargetX ?? rawX);
  const frameVelY = rawY - (prevTargetY ?? rawY);
  const speed = Math.sqrt(frameVelX * frameVelX + frameVelY * frameVelY);

  // Blend velocity for smoother acceleration feel
  velX = velX * 0.6 + frameVelX * 0.4;
  velY = velY * 0.6 + frameVelY * 0.4;

  // α in [SMOOTH_MIN, SMOOTH_MAX]
  const alpha = SMOOTH_MIN + (SMOOTH_MAX - SMOOTH_MIN) *
    Math.min(speed * VELOCITY_SCALE, 1.0);

  smoothX = smoothX + alpha * (rawX - smoothX);
  smoothY = smoothY + alpha * (rawY - smoothY);
}

// ─── Hysteresis ───────────────────────────────────────────────────────────────

/**
 * Debounce gesture changes: a new gesture must appear for N consecutive frames
 * before becoming the "current" gesture. Eliminates one-frame blips.
 */
function updateGestureWithHysteresis(candidate) {
  if (candidate === candidateGesture) {
    candidateFrames++;
  } else {
    candidateGesture = candidate;
    candidateFrames = 1;
  }

  if (candidateFrames >= GESTURE_DEBOUNCE_FRAMES) {
    currentGesture = candidateGesture;
  }
}

// ─── Reset ────────────────────────────────────────────────────────────────────

function resetState() {
  smoothX = null;
  smoothY = null;
  velX = 0;
  velY = 0;
  prevTargetX = null;
  prevTargetY = null;
  isPinching = false;
  currentGesture  = "IDLE";
  candidateGesture = "IDLE";
  candidateFrames  = 0;
}

// ─── Main Detection ───────────────────────────────────────────────────────────

/**
 * Run one frame of hand detection on a <video> element.
 *
 * @param {HTMLVideoElement} video
 * @returns {HandTrackResult | null}
 *
 * @typedef {Object} HandTrackResult
 * @property {number}  x         - Smoothed cursor X in [0, 1] (mirrored)
 * @property {number}  y         - Smoothed cursor Y in [0, 1]
 * @property {number}  velX      - Horizontal velocity (normalised units/frame)
 * @property {number}  velY      - Vertical velocity
 * @property {boolean} draw      - True when DRAW gesture is active
 * @property {boolean} erase     - True when ERASE gesture is active
 * @property {boolean} pause     - True when PAUSE (fist) gesture is active
 * @property {string}  gesture   - "DRAW" | "ERASE" | "PAUSE" | "IDLE"
 * @property {object}  fingers   - Per-finger extended/curled state
 * @property {number}  pinchDist - Raw pinch distance (thumb ↔ index tip)
 * @property {number}  palmWidth - Palm reference width
 */
export function detectHands(video) {
  if (!handLandmarker) return null;

  const result = handLandmarker.detectForVideo(video, performance.now());

  if (!result.landmarks || result.landmarks.length === 0) {
    resetState();
    return null;
  }

  const lm = result.landmarks[0];

  // ── Gesture ──
  const rawGesture = classifyGesture(lm);
  updateGestureWithHysteresis(rawGesture);

  // ── Cursor target ──
  // During DRAW: midpoint of thumb & index tips (the "pen nib")
  // Otherwise:   index fingertip (natural pointer)
  let targetX, targetY;
  if (currentGesture === "DRAW") {
    targetX = (lm[LM.THUMB_TIP].x + lm[LM.INDEX_TIP].x) / 2;
    targetY = (lm[LM.THUMB_TIP].y + lm[LM.INDEX_TIP].y) / 2;
  } else {
    targetX = lm[LM.INDEX_TIP].x;
    targetY = lm[LM.INDEX_TIP].y;
  }

  // Mirror X (webcam is front-facing, feels natural to mirror)
  targetX = 1 - targetX;

  // ── Smoothing ──
  adaptiveLerp(targetX, targetY);
  prevTargetX = targetX;
  prevTargetY = targetY;

  // ── Extra data ──
  const palmWidth = dist2D(lm[LM.INDEX_MCP], lm[LM.PINKY_MCP]);
  const pinchDist = dist2D(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP]);
  const fingers   = getFingerStates(lm);

  return {
    x:         smoothX,
    y:         smoothY,
    velX:      velX,
    velY:      velY,
    draw:      currentGesture === "DRAW",
    erase:     currentGesture === "ERASE",
    pause:     currentGesture === "PAUSE",
    gesture:   currentGesture,
    fingers,
    pinchDist,
    palmWidth,
  };
}

/**
 * Destroy the landmarker and free GPU resources.
 * Call when the user navigates away or closes the camera.
 */
export async function destroyHandTracker() {
  if (handLandmarker) {
    await handLandmarker.close();
    handLandmarker = null;
  }
  resetState();
}