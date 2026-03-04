import { useRef, useEffect } from "react";
import socket from "../utils/socket";

function Canvas() {

  const canvasRef = useRef(null);

  // Draw a small circle on canvas
  const draw = (x, y) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  // Handle mouse drawing
  const handleMouseMove = (e) => {

    if (e.buttons !== 1) return; // draw only when mouse pressed

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    draw(x, y);

    // Send coordinates to server
    socket.emit("draw_event", {
      roomId: "room1",
      x,
      y
    });
  };

  useEffect(() => {

    // Receive drawing from other users
    socket.on("draw_event", (data) => {
      draw(data.x, data.y);
    });

  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={500}
      onMouseMove={handleMouseMove}
      style={{ border: "2px solid black" }}
    />
  );
}

export default Canvas;