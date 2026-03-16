import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let handLandmarker;
let smoothedX = null;
let smoothedY = null;

export async function initHandTracker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU" 
    },
    runningMode: "VIDEO",
    numHands: 1,
    // Dropped the confidence slightly so it doesn't lose your hand when you pinch tight
    minHandDetectionConfidence: 0.65, 
    minHandPresenceConfidence: 0.65,  
    minTrackingConfidence: 0.65       
  });
}

// 📏 Pure 2D Distance Formula (Bulletproof for standard webcams)
function get2DDist(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

export function detectHands(video) {
  if (!handLandmarker) return null;

  const result = handLandmarker.detectForVideo(video, performance.now());

  if (result.landmarks.length === 0) {
    smoothedX = null;
    smoothedY = null;
    return null;
  }

  const landmarks = result.landmarks[0];

  // 1. THE DYNAMIC RULER
  // Measure the base of index finger to base of pinky to get the width of your palm.
  const palmWidth = get2DDist(landmarks[5], landmarks[17]);

  // 2. FORGIVING PINCH (DRAW)
  // Distance between Thumb tip (4) and Index tip (8)
  const pinchDist = get2DDist(landmarks[4], landmarks[8]);
  // If the gap is smaller than 80% of your palm width, it counts as a pinch. 
  const isDrawing = pinchDist < (palmWidth * 0.8);

  // 3. OPEN PALM (ERASE)
  // Distance from Wrist (0) to Middle Finger tip (12)
  const handLength = get2DDist(landmarks[0], landmarks[12]);
  // If your hand is stretched out, and you are NOT currently pinching, erase.
  const isErasing = (handLength > (palmWidth * 1.8)) && !isDrawing;

  // 4. TARGET ALIGNMENT
  // Track the exact center between your thumb and index finger
  const targetX = (landmarks[8].x + landmarks[4].x) / 2;
  const targetY = (landmarks[8].y + landmarks[4].y) / 2;

  // 5. BUTTERY SMOOTHING
  const smoothingFactor = 0.4;
  if (smoothedX === null || smoothedY === null) {
    smoothedX = targetX;
    smoothedY = targetY;
  } else {
    smoothedX = smoothedX + smoothingFactor * (targetX - smoothedX);
    smoothedY = smoothedY + smoothingFactor * (targetY - smoothedY);
  }

  return {
    x: smoothedX,
    y: smoothedY,
    draw: isDrawing,
    erase: isErasing 
  };
}