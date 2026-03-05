// Import MediaPipe Tasks Vision
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let handLandmarker;

// Initialize MediaPipe hand tracker
export async function initHandTracker() {

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
    },
    runningMode: "VIDEO",
    numHands: 1
  });
}

// Detect hand landmarks
export function detectHands(video) {

  if (!handLandmarker) return null;

  const result = handLandmarker.detectForVideo(video, performance.now());

  if (result.landmarks.length === 0) return null;

  const landmarks = result.landmarks[0];

  const index = landmarks[8]; // index tip
  const thumb = landmarks[4]; // thumb tip

  // distance between thumb and index
  const dx = index.x - thumb.x;
  const dy = index.y - thumb.y;

  const distance = Math.sqrt(dx * dx + dy * dy);

  // pinch threshold
  const isPinching = distance < 0.05;

  return {
    x: index.x,
    y: index.y,
    draw: isPinching
  };
}