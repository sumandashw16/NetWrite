import { useRef, useEffect } from "react";
import socket from "../utils/socket";
import { initHandTracker, detectHands } from "../utils/handTracker";

function Canvas({ roomId, onLeave }) {
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

  const colorRef = useRef("#000000");
  const brushSizeRef = useRef(3);

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

  // Reusable function to completely wipe the ink
  const clearBoard = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    // Also reset the last known positions so lines don't accidentally connect across the wiped board
    localLastPos.current = null;
    remoteLastPos.current = null;
  };

  // What happens when YOU click the button
  const handleClearClick = () => {
    clearBoard(); // Clear your own screen
    socket.emit("clear_canvas", { roomId: roomId }); // Tell the server to tell everyone else
  };

  useEffect(() => {
    socket.emit("join_room", roomId);
    
    // 🛡️ NEW: Safe storage for our camera and a kill-switch for the loops
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
      if (!isRunning) return; // 🛑 Stops the loop if we left the room
      drawCursors();
      requestAnimationFrame(renderCursorsLoop);
    };

    let lastVideoTime = -1;

    const loop = () => {
      if (!isRunning) return; // 🛑 Stops the loop if we left the room

      const video = videoRef.current;
      if (video && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const finger = detectHands(video);

        if (finger) {
          const canvas = canvasRef.current;
          if (!canvas) return; // Safety check

          const x = (1 - finger.x) * canvas.width; 
          const y = finger.y * canvas.height;

          localCursor.current = { x, y };
          const isActive = finger.draw || finger.erase;
          
          // --- 1. LOCAL DRAWING ---
          if (isActive) {
            if (!localLastPos.current) {
              localLastPos.current = { x, y };
            } else {
              const ctx = canvasRef.current?.getContext("2d");
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
            localLastPos.current = null;
          }

          // --- 2. NETWORK EMITTER ---
          const stateChanged = finger.draw !== lastEmitted.current.drawing;
          const moved = Math.abs(x - lastEmitted.current.x) > 1 || Math.abs(y - lastEmitted.current.y) > 1;

          if (stateChanged || moved) {
            socket.emit("draw_event", {
              roomId: roomId,
              x: x,
              y: y,
              drawing: finger.draw,
              color: colorRef.current,
              size: brushSizeRef.current,
              erasing: finger.erase
            });
            lastEmitted.current = { x, y, drawing: finger.draw, erasing: finger.erase };
          }

        } else {
          localLastPos.current = null;
          if (lastEmitted.current.drawing === true) {
            socket.emit("draw_event", { roomId: roomId, drawing: false });
            lastEmitted.current.drawing = false;
          }
        }
      }
      requestAnimationFrame(loop);
    };

    start();

    // --- 3. BULLETPROOF REMOTE RECEIVER ---
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
      }
    };

    socket.on("draw_event", handleRemoteDraw);
    socket.on("clear_canvas", () => {
      clearBoard();
    });

    // 🧹 THE ULTIMATE CLEANUP
    return () => {
      isRunning = false; // Instantly kills the drawing loops
      socket.off("draw_event", handleRemoteDraw);
      socket.off("clear_canvas");

      // Uses the safely stored localStream to guarantee the camera dies
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      
      {/* NEW: Display the room code at the top */}
      <h2>Room Code: <span style={{ color: "#2196F3" }}>{roomId}</span></h2>

      {/* Your existing layout wrapped inside */}
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
        
        {/* Video and Toolbar Side Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
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
          
          <div style={{ display: "flex", alignItems: "center", gap: "15px", backgroundColor: "#222", padding: "10px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <label style={{ color: "white", fontFamily: "sans-serif" }}>Color:</label>
              <input 
                type="color" 
                defaultValue="#000000"
                onChange={(e) => { colorRef.current = e.target.value }} 
                style={{ cursor: "pointer", width: "40px", height: "40px", padding: "0", border: "none" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <label style={{ color: "white", fontFamily: "sans-serif" }}>Size:</label>
              <input 
                type="range" 
                min="1" 
                max="20" 
                defaultValue="3"
                onChange={(e) => { brushSizeRef.current = parseInt(e.target.value) }} 
                style={{ cursor: "pointer" }}
              />
            </div>
          </div>

          <button 
            onClick={() => {
              // Ensure we use the new dynamic roomId when clearing!
              clearBoard();
              socket.emit("clear_canvas", { roomId: roomId }); 
            }}
            style={{ padding: "10px", fontSize: "16px", cursor: "pointer", background: "#ff4444", color: "white", border: "none", borderRadius: "5px" }}
          >
            Clear Canvas
          </button>
          <button 
            onClick={onLeave}
            style={{ padding: "10px", fontSize: "16px", cursor: "pointer", background: "#555", color: "white", border: "none", borderRadius: "5px" }}
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}

export default Canvas;