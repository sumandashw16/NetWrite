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
  const index = landmarks[8]; // Index tip
  const thumb = landmarks[4]; // Thumb tip
  
  // NEW: Grab the extra points we need for the Eraser math
  const wrist = landmarks[0];
  const middleTip = landmarks[12];
  const indexBase = landmarks[5];
  const pinkyBase = landmarks[17];

  // 1. PINCH MATH (For Drawing)
  const dx = index.x - thumb.x;
  const dy = index.y - thumb.y;
  const dz = index.z - thumb.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (distance < 0.04) isCurrentlyPinching = true;
  else if (distance > 0.06) isCurrentlyPinching = false;

  // 2. OPEN PALM MATH (For Erasing)
  // First, calculate the width of the palm. We use this as a "ruler" so the 
  // gesture works whether your hand is close to the camera or far away!
  const palmDx = indexBase.x - pinkyBase.x;
  const palmDy = indexBase.y - pinkyBase.y;
  const palmDz = indexBase.z - pinkyBase.z;
  const palmSize = Math.sqrt(palmDx * palmDx + palmDy * palmDy + palmDz * palmDz);

  // Next, calculate how far the middle finger is from the wrist
  const midDx = middleTip.x - wrist.x;
  const midDy = middleTip.y - wrist.y;
  const midDz = middleTip.z - wrist.z;
  const midDist = Math.sqrt(midDx * midDx + midDy * midDy + midDz * midDz);

  // If the finger is extended more than 1.8x the width of the palm, the hand is "Open".
  // (We also make sure you aren't currently pinching to avoid accidental erasing).
  const isErasing = (midDist / palmSize > 1.8) && !isCurrentlyPinching;

  // 3. TARGET MIDPOINT
  const targetX = (index.x + thumb.x) / 2;
  const targetY = (index.y + thumb.y) / 2;

  // 4. SMOOTHING
  const smoothingFactor = 0.5;
  if (smoothedX === null || smoothedY === null) {
    smoothedX = targetX;
    smoothedY = targetY;
  } else {
    smoothedX = smoothedX + smoothingFactor * (targetX - smoothedX);
    smoothedY = smoothedY + smoothingFactor * (targetY - smoothedY);
  }

  // Send BOTH states back to the Canvas
  return {
    x: smoothedX,
    y: smoothedY,
    draw: isCurrentlyPinching,
    erase: isErasing // <-- NEW
  };
}