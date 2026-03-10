import { useState } from "react";
import Canvas from "./components/Canvas"; // Adjust this import path if needed!

function App() {
  const [roomId, setRoomId] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  // When Host is clicked, generate a random 4-letter code
  const handleHost = () => {
    const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    setRoomId(randomCode);
    setInRoom(true);
  };

  // When Join is clicked, use the typed code
  const handleJoin = () => {
    if (joinCode.trim().length > 0) {
      setRoomId(joinCode.trim().toUpperCase());
      setInRoom(true);
    }
  };

  // If they are in a room, render the Canvas and pass the roomId as a prop
  if (inRoom) {
    return <Canvas roomId={roomId} />;
  }

  // Otherwise, render the Landing Page
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "100px", fontFamily: "sans-serif" }}>
      <h1>Magic AI Whiteboard</h1>
      
      <div style={{ display: "flex", gap: "40px", marginTop: "40px", padding: "40px", backgroundColor: "#f0f0f0", borderRadius: "10px" }}>
        
        {/* HOST SECTION */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
          <h3>Start a New Board</h3>
          <button 
            onClick={handleHost}
            style={{ padding: "15px 30px", fontSize: "18px", cursor: "pointer", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "5px" }}
          >
            Host Room
          </button>
        </div>

        {/* JOIN SECTION */}
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
    </div>
  );
}

export default App;