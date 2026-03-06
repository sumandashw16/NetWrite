// Import MediaPipe Tasks Vision
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let handLandmarker;

// Variables to keep track of state between frames
let smoothedX = null;
let smoothedY = null;
let isCurrentlyPinching = false;

// Initialize MediaPipe hand tracker with High-Precision Settings
export async function initHandTracker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU" // Forces hardware acceleration for better performance
    },
    runningMode: "VIDEO",
    numHands: 1,
    // Stricter confidence prevents the AI from making jittery "guesses"
    minHandDetectionConfidence: 0.7, 
    minHandPresenceConfidence: 0.7,  
    minTrackingConfidence: 0.7       
  });
}

// Detect hand landmarks and process coordinates
export function detectHands(video) {
  if (!handLandmarker) return null;

  // Using performance.now() ensures strictly increasing timestamps, 
  // which prevents MediaPipe from freezing your network stream.
  const nowInMs = performance.now();
  const result = handLandmarker.detectForVideo(video, nowInMs);

  // If no hand is detected, reset tracking variables
  if (result.landmarks.length === 0) {
    smoothedX = null;
    smoothedY = null;
    isCurrentlyPinching = false;
    return null;
  }

  const landmarks = result.landmarks[0];
  const index = landmarks[8]; // index tip
  const thumb = landmarks[4]; // thumb tip

  // 1. Calculate 3D distance (x, y, and depth z) for accurate pinch detection
  const dx = index.x - thumb.x;
  const dy = index.y - thumb.y;
  const dz = index.z - thumb.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // 2. Hysteresis thresholds to prevent the "flickering pen" effect
  const PINCH_START = 0.04; // Must get this close to start drawing
  const PINCH_STOP = 0.06;  // Must pull apart this far to stop drawing

  if (distance < PINCH_START) {
    isCurrentlyPinching = true;
  } else if (distance > PINCH_STOP) {
    isCurrentlyPinching = false;
  }

  // 3. Target the midpoint between the fingers for a natural drawing feel
  const targetX = (index.x + thumb.x) / 2;
  const targetY = (index.y + thumb.y) / 2;

  // 4. Exponential Moving Average (EMA) Smoothing
  // This replaces the smooth() function you used to have in Canvas.jsx
  const smoothingFactor = 0.5; // Tweak between 0.1 (smooth/laggy) and 0.9 (fast/jittery)

  if (smoothedX === null || smoothedY === null) {
    smoothedX = targetX;
    smoothedY = targetY;
  } else {
    smoothedX = smoothedX + smoothingFactor * (targetX - smoothedX);
    smoothedY = smoothedY + smoothingFactor * (targetY - smoothedY);
  }

  // Return the perfectly packaged payload ready for your Canvas and Sockets
  return {
    x: smoothedX,
    y: smoothedY,
    draw: isCurrentlyPinching
  };
}