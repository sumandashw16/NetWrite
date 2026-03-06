import { useRef, useEffect } from "react";
import socket from "../utils/socket";
import { initHandTracker, detectHands } from "../utils/handTracker";

function Canvas() {
  const canvasRef = useRef(null);
  const cursorCanvasRef = useRef(null);
  const videoRef = useRef(null);

  // If these are 'null', the pen is hovering. 
  // If they hold {x, y}, the pen is dragging on the canvas.
  const localLastPos = useRef(null);
  const remoteLastPos = useRef(null);

  // Track the floating cursors
  const localCursor = useRef({ x: 0, y: 0 });
  const remoteCursor = useRef({ x: 0, y: 0, active: false });

  // Prevent network spam
  const lastEmitted = useRef({ x: 0, y: 0, drawing: false });

  const drawCursors = () => {
    const ctx = cursorCanvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, cursorCanvasRef.current.width, cursorCanvasRef.current.height);

    // Local Cursor (Red)
    ctx.beginPath();
    ctx.arc(localCursor.current.x, localCursor.current.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "red";
    ctx.fill();

    // Remote Cursor (Blue)
    if (remoteCursor.current.active) {
      ctx.beginPath();
      ctx.arc(remoteCursor.current.x, remoteCursor.current.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "blue";
      ctx.fill();
    }
  };

  useEffect(() => {
    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      await initHandTracker();
      
      requestAnimationFrame(loop);
      requestAnimationFrame(renderCursorsLoop); 
    };

    const renderCursorsLoop = () => {
      drawCursors();
      requestAnimationFrame(renderCursorsLoop);
    };

    let lastVideoTime = -1;

    const loop = () => {
      const video = videoRef.current;
      if (video && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const finger = detectHands(video);

        if (finger) {
          const canvas = canvasRef.current;
          const x = (1 - finger.x) * canvas.width; 
          const y = finger.y * canvas.height;

          localCursor.current = { x, y };

          // --- 1. LOCAL DRAWING ---
          if (finger.draw) {
            if (!localLastPos.current) {
              // Pen just touched the canvas
              localLastPos.current = { x, y };
            } else {
              // Pen is dragging, connect the line!
              const ctx = canvasRef.current?.getContext("2d");
              if (ctx) {
                ctx.lineWidth = 3;
                ctx.lineCap = "round";
                ctx.strokeStyle = "black";
                ctx.beginPath();
                ctx.moveTo(localLastPos.current.x, localLastPos.current.y);
                ctx.lineTo(x, y);
                ctx.stroke();
              }
              // Update position for the next frame
              localLastPos.current = { x, y };
            }
          } else {
            // Pinch released, lift pen
            localLastPos.current = null;
          }

          // --- 2. NETWORK EMITTER ---
          const stateChanged = finger.draw !== lastEmitted.current.drawing;
          // Only emit if moving more than 1 pixel (keeps network fast without losing curves)
          const moved = Math.abs(x - lastEmitted.current.x) > 1 || Math.abs(y - lastEmitted.current.y) > 1;

          if (stateChanged || moved) {
            socket.emit("draw_event", {
              roomId: "room1",
              x: x,
              y: y,
              drawing: finger.draw
            });
            lastEmitted.current = { x, y, drawing: finger.draw };
          }

        } else {
          // Hand lost off camera
          localLastPos.current = null;
          if (lastEmitted.current.drawing === true) {
            socket.emit("draw_event", { roomId: "room1", drawing: false });
            lastEmitted.current.drawing = false;
          }
        }
      }
      requestAnimationFrame(loop);
    };

    start();

    // --- 3. BULLETPROOF REMOTE RECEIVER ---
    // --- 3. BULLETPROOF REMOTE RECEIVER ---
    const handleRemoteDraw = (data) => {
      // THE SMOKING GUN: Open your participant's browser console (F12) to see this!
      console.log("RECEIVED FROM SERVER:", data); 

      // Always update cursor position
      if (data.x !== undefined && data.y !== undefined) {
          remoteCursor.current = { x: data.x, y: data.y, active: true };
      }

      // If drawing is true, put ink on the screen NO MATTER WHAT
      if (data.drawing) {
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) {
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.strokeStyle = "blue"; 
          ctx.beginPath();
          
          if (remoteLastPos.current) {
            // Dragging: connect to the previous point
            ctx.moveTo(remoteLastPos.current.x, remoteLastPos.current.y);
          } else {
            // Just touched down: Draw a visible dot exactly where the cursor is
            ctx.moveTo(data.x, data.y);
          }
          
          ctx.lineTo(data.x, data.y);
          ctx.stroke();
        }
        // Save this point for the next packet
        remoteLastPos.current = { x: data.x, y: data.y };
      } else {
        // Pen is lifted
        remoteLastPos.current = null;
      }
    };

    socket.on("draw_event", handleRemoteDraw);

    return () => {
      socket.off("draw_event", handleRemoteDraw);
    };
  }, []);

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          style={{ border: "2px solid black", backgroundColor: "white" }} 
        />
        <canvas
          ref={cursorCanvasRef}
          width={800}
          height={500}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            pointerEvents: "none"
          }}
        />
      </div>
      <video
        ref={videoRef}
        width={300}
        height={200}
        autoPlay
        style={{
          border: "2px solid black",
          transform: "scaleX(-1)"
        }}
      />
    </div>
  );
}

export default Canvas;