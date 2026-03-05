import { useRef, useEffect } from "react";
import socket from "../utils/socket";
import { initHandTracker, detectHands } from "../utils/handTracker";

function Canvas() {

  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const drawing = useRef(false)

  // store last smoothed position
  const lastX = useRef(0);
  const lastY = useRef(0);

  // smooth finger movement
  const smooth = (x, y) => {

    const alpha = 0.7;

    lastX.current = alpha * lastX.current + (1 - alpha) * x;
    lastY.current = alpha * lastY.current + (1 - alpha) * y;

    return { x: lastX.current, y: lastY.current };
  };

  // draw continuous line
  const draw = (x, y) => {

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    if (!drawing.current) {
      // start new stroke
      ctx.beginPath();
      ctx.moveTo(x, y);
      drawing.current = true;
    } else {
      // continue stroke
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  useEffect(() => {

    const start = async () => {

      // start webcam
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;

      await videoRef.current.play();

      // init mediapipe
      await initHandTracker();

      loop();
    };

    let lastVideoTime = -1;

    const loop = () => {

      const video = videoRef.current;

      if (video.currentTime !== lastVideoTime) {

        lastVideoTime = video.currentTime;

        const finger = detectHands(video);

        if (finger) {

          const canvas = canvasRef.current;

          const x = (1 - finger.x) * canvas.width;
          const y = finger.y * canvas.height;

          const p = smooth(x, y);

          if (finger.draw) {

            draw(p.x, p.y);

            socket.emit("draw_event", {
              roomId: "room1",
              x: p.x,
              y: p.y
            });

          } else {
            // stop drawing when pinch released
            drawing.current = false;
          }
        }
      }

      requestAnimationFrame(loop);
    };

    start();

    // receive drawings from other users
    socket.on("draw_event", (data) => {
      draw(data.x, data.y);
    });

  }, []);

  return (
    <div style={{ display: "flex", gap: "20px" }}>

      {/* drawing canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{ border: "2px solid black" }}
      />

      {/* local webcam preview */}
      <video
        ref={videoRef}
        width={300}
        height={200}
        autoPlay
        style={{
          border: "2px solid black",
          transform: "scaleX(-1)" // mirror webcam
        }}
      />

    </div>
  );
}

export default Canvas;