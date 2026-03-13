import { useState } from "react";
import Canvas from "./Canvas"; 
import { useNavigate } from "react-router-dom";
import "./WhiteboardArea.css"; // 🏎️ Loading the Ferrari Command Center styles

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

  if (inRoom) {
    return (
      <Canvas 
        roomId={roomId} 
        onLeave={() => {
          setInRoom(false);
          setRoomId("");
        }} 
      />
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>NETWRITE</h1>
        <p className="welcome-text">
          Status: <span className="username-highlight">{localStorage.getItem("username")}</span> • READY TO RACE
        </p>
      </div>
      
      <div className="mission-control-card">
        <div className="actions-grid">
          
          {/* HOST SECTION */}
          <div className="action-section">
            <h3>CREATE PADDOCK</h3>
            <button className="btn-host" onClick={handleHost}>
              Host Room
            </button>
          </div>

          <div className="divider"></div>

          {/* JOIN SECTION */}
          <div className="action-section">
            <h3>ENTER PIT LANE</h3>
            <input 
              className="room-input"
              type="text" 
              placeholder="CODE" 
              maxLength={4}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button className="btn-join" onClick={handleJoin}>
              Join Room
            </button>
          </div>

        </div>

        <button className="btn-logout" onClick={handleLogout}>
          Secure Logout
        </button>
      </div>
    </div>
  );
}