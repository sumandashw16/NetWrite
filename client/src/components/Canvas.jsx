import { useRef, useEffect } from "react";
import socket from "../utils/socket";
// ✅ NEW: import destroyHandTracker for GPU cleanup on unmount
import { initHandTracker, detectHands, destroyHandTracker } from "../utils/handTracker";
import "./Canvas.css";

function Canvas({ roomId, onLeave }) {
  const canvasRef = useRef(null);
  const cursorCanvasRef = useRef(null);
  const videoRef = useRef(null);

  const localLastPos = useRef(null);
  const remoteLastPos = useRef(null);

  const localCursor = useRef({ x: 0, y: 0, gesture: "IDLE" }); // ✅ NEW: track gesture for cursor style
  const remoteCursor = useRef({ x: 0, y: 0, active: false });

  const lastEmitted = useRef({ x: 0, y: 0, drawing: false, erasing: false });

  const colorRef = useRef("#000000");
  const brushSizeRef = useRef(3);

  // ─── Cursor Renderer ───────────────────────────────────────────────────────
  // ✅ CHANGED: cursor now reflects gesture visually
  const drawCursors = () => {
    const cursorCanvas = cursorCanvasRef.current;
    const ctx = cursorCanvas?.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

    const { x, y, gesture } = localCursor.current;

    switch (gesture) {
      case "DRAW":
        // Filled dot — you're drawing
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = colorRef.current;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;

      case "ERASE":
        // Hollow ring — eraser
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 80, 80, 0.85)";
        ctx.lineWidth = 2;
        ctx.stroke();
        break;

      case "PAUSE":
        // Small hollow square — pen lifted / paused
        ctx.strokeStyle = "rgba(255, 200, 0, 0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 6, y - 6, 12, 12);
        break;

      default:
        // IDLE — simple outline dot
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(150, 150, 150, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
    }

    // Remote Cursor (Blue)
    if (remoteCursor.current.active) {
      ctx.beginPath();
      ctx.arc(remoteCursor.current.x, remoteCursor.current.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(80, 130, 255, 0.85)";
      ctx.fill();
    }
  };

  // ─── Clear Board ───────────────────────────────────────────────────────────
  const clearBoard = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.globalCompositeOperation = "source-over"; // ✅ FIX: un-stick erase mode before clearing
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    localLastPos.current = null;
    remoteLastPos.current = null;
  };

  const handleClearClick = () => {
    clearBoard();
    socket.emit("clear_canvas", { roomId });
  };

  // ─── Main Effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    socket.emit("join_room", roomId);

    let localStream = null;
    let isRunning = true;

    const start = async () => {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = localStream;
        await videoRef.current.play();
      }
      await initHandTracker();

      if (isRunning) {
        requestAnimationFrame(loop);
        requestAnimationFrame(renderCursorsLoop);
      }
    };

    const renderCursorsLoop = () => {
      if (!isRunning) return;
      drawCursors();
      requestAnimationFrame(renderCursorsLoop);
    };

    let lastVideoTime = -1;

    const loop = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      if (video && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const finger = detectHands(video);

        if (finger) {
          const canvas = canvasRef.current;
          if (!canvas) return;

          // ✅ FIX 1: Remove the (1 - finger.x) flip here.
          // The new tracker already mirrors X internally.
          // The old tracker did NOT mirror, so the old canvas compensated.
          // Keeping (1 - x) here would double-flip and invert your cursor.
          const x = finger.x * canvas.width;
          const y = finger.y * canvas.height;

          // ✅ NEW: store gesture so drawCursors can style accordingly
          localCursor.current = { x, y, gesture: finger.gesture };

          // ✅ FIX 2: PAUSE (fist) lifts the pen without erasing.
          // isActive is now false during pause, so no accidental marks.
          const isActive = finger.draw || finger.erase;

          // --- 1. LOCAL DRAWING ---
          if (isActive) {
            if (!localLastPos.current) {
              localLastPos.current = { x, y };
            } else {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                if (finger.erase) {
                  ctx.globalCompositeOperation = "destination-out";
                  ctx.lineWidth = 30;
                } else {
                  ctx.globalCompositeOperation = "source-over";
                  ctx.lineWidth = brushSizeRef.current;
                  ctx.strokeStyle = colorRef.current;
                }

                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(localLastPos.current.x, localLastPos.current.y);
                ctx.lineTo(x, y);
                ctx.stroke();
              }
              localLastPos.current = { x, y };
            }
          } else {
            // ERASE off, DRAW off, or PAUSE — lift the pen
            localLastPos.current = null;
            // ✅ FIX: always reset composite mode when stroke ends,
            // so the next draw operation isn't accidentally still in erase mode
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.globalCompositeOperation = "source-over";
          }

          // --- 2. NETWORK EMITTER ---
          // --- 2. BULLETPROOF NETWORK EMITTER ---
          const stateChanged =
            finger.draw  !== lastEmitted.current.drawing ||
            finger.erase !== lastEmitted.current.erasing;
            
          const moved =
            Math.abs(x - lastEmitted.current.x) > 1 ||
            Math.abs(y - lastEmitted.current.y) > 1;

          // 🚨 THE FIX: Only tell the server if we changed state (pen down/up)
          // OR if we are ACTIVELY drawing/erasing and moving. Do NOT spam hover data!
          if (stateChanged || (isActive && moved)) {
            socket.emit("draw_event", {
              roomId,
              x,
              y,
              drawing: finger.draw,
              color: colorRef.current,
              size: brushSizeRef.current,
              erasing: finger.erase,
            });
            lastEmitted.current = {
              x,
              y,
              drawing: finger.draw,
              erasing: finger.erase,
            };
          }
        } else {
          // Hand lost — lift pen and notify remote
          localLastPos.current = null;
          localCursor.current = { ...localCursor.current, gesture: "IDLE" };

          if (lastEmitted.current.drawing || lastEmitted.current.erasing) {
            socket.emit("draw_event", { roomId, drawing: false, erasing: false });
            lastEmitted.current.drawing = false;
            lastEmitted.current.erasing = false;
          }
        }
      }
      requestAnimationFrame(loop);
    };

    start();

    // --- 3. REMOTE RECEIVER ---
    const handleRemoteDraw = (data) => {
      if (data.x !== undefined && data.y !== undefined) {
        remoteCursor.current = { x: data.x, y: data.y, active: true };
      }

      const isRemoteActive = data.drawing || data.erasing;

      if (isRemoteActive) {
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) {
          if (data.erasing) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.lineWidth = 40;
          } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.lineWidth = data.size || 3;
            ctx.strokeStyle = data.color || "blue";
          }

          ctx.lineCap = "round";
          ctx.beginPath();

          if (remoteLastPos.current) {
            ctx.moveTo(remoteLastPos.current.x, remoteLastPos.current.y);
          } else {
            ctx.moveTo(data.x, data.y);
          }

          ctx.lineTo(data.x, data.y);
          ctx.stroke();
        }
        remoteLastPos.current = { x: data.x, y: data.y };
      } else {
        remoteLastPos.current = null;
        // ✅ FIX: reset composite mode on the remote canvas too,
        // otherwise a finished erase stroke leaves it stuck in destination-out
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx) ctx.globalCompositeOperation = "source-over";
      }
    };

    socket.on("draw_event", handleRemoteDraw);
    socket.on("clear_canvas", clearBoard);

    // ─── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      isRunning = false;
      socket.off("draw_event", handleRemoteDraw);
      socket.off("clear_canvas", clearBoard);

      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }

      // ✅ FIX 3: Properly shut down MediaPipe and free GPU memory
      destroyHandTracker();
    };
  }, [roomId]);

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="canvas-layout-wrapper">
      <h2 className="room-header">
        TELEMETRY LINK: <span className="room-code-highlight">{roomId}</span>
      </h2>

      <div className="main-cockpit">
        {/* DRAWING ZONE */}
        <div className="canvas-frame">
          <canvas ref={canvasRef} width={800} height={500} />
          <canvas
            ref={cursorCanvasRef}
            width={800}
            height={500}
            style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
          />
        </div>

        {/* CONTROL SIDEBAR */}
        <div className="side-panel">
          <video
            ref={videoRef}
            width={320}
            height={240}
            autoPlay
            className="video-feed"
          />

          <div className="control-bar">
            <div className="tool-row">
              <label>INK COLOR</label>
              <input
                type="color"
                defaultValue="#000000"
                onChange={(e) => { colorRef.current = e.target.value; }}
              />
            </div>

            <div className="tool-row">
              <label>BRUSH WIDTH</label>
              <input
                type="range"
                min="1"
                max="20"
                defaultValue="3"
                onChange={(e) => { brushSizeRef.current = parseInt(e.target.value); }}
              />
            </div>

            <button className="btn-action btn-clear" onClick={handleClearClick}>
              Reset Board
            </button>

            <button className="btn-action btn-leave" onClick={onLeave}>
              Exit Pit Lane
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Canvas;