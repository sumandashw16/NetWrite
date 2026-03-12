import { useState } from "react";
import Canvas from "./Canvas"; 
import { useNavigate } from "react-router-dom";

export default function WhiteboardArea() {
  const [roomId, setRoomId] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const navigate = useNavigate();

  const handleHost = () => {
    const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    setRoomId(randomCode);
    setInRoom(true);
  };

  const handleJoin = () => {
    if (joinCode.trim().length > 0) {
      setRoomId(joinCode.trim().toUpperCase());
      setInRoom(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token"); 
    localStorage.removeItem("username"); 
    navigate("/login"); 
  };

  // If they are in a room, render the Canvas and pass the roomId AND the onLeave function
  if (inRoom) {
    return (
      <Canvas 
        roomId={roomId} 
        onLeave={() => {
          setInRoom(false); // Changes the screen back to the menu
          setRoomId("");    // Clears the room code
        }} 
      />
    );
  }

  // Otherwise, render the Landing Page
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "100px", fontFamily: "sans-serif" }}>
      <h1>Magic AI Whiteboard</h1>
      <p>Welcome, {localStorage.getItem("username")}! 🎨</p> 
      
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "20px", padding: "40px", backgroundColor: "#f0f0f0", borderRadius: "10px" }}>
        
        <div style={{ display: "flex", gap: "40px", marginBottom: "30px" }}>
          
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <h3>Start a New Board</h3>
            <button 
              onClick={handleHost}
              style={{ padding: "15px 30px", fontSize: "18px", cursor: "pointer", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "5px" }}
            >
              Host Room
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", borderLeft: "2px solid #ccc", paddingLeft: "40px" }}>
            <h3>Join a Friend</h3>
            <input 
              type="text" 
              placeholder="Enter 4-Letter Code" 
              maxLength={4}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              style={{ padding: "10px", fontSize: "16px", textAlign: "center", width: "150px" }}
            />
            <button 
              onClick={handleJoin}
              style={{ padding: "10px 30px", fontSize: "16px", cursor: "pointer", backgroundColor: "#2196F3", color: "white", border: "none", borderRadius: "5px" }}
            >
              Join Room
            </button>
          </div>
        </div>

        <button onClick={handleLogout} style={{ background: "#ff4d4d", cursor: "pointer", color: "white", padding: "10px 20px", border: "none", borderRadius: "5px", width: "100%" }}>
          Logout Securely
        </button>

      </div>
    </div>
  );
}