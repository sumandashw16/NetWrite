import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Register.css"; // 🏎️ Loading the Team Registration styles

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Registration successful! Welcome to the Team.");
        navigate("/login"); 
      } else {
        setError(data.message || "Registration failed");
      }
    } catch (err) {
      setError("Server error. Is the pit crew online?");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 className="auth-title">TEAM SIGN-UP</h2>
        
        {error && <div className="error-badge">{error}</div>}
        
        <form onSubmit={handleRegister} className="auth-form">
          <input 
            type="text" placeholder="CHOOSE CALLSIGN (Username)" required 
            value={username} onChange={(e) => setUsername(e.target.value)} 
            className="auth-input"
          />
          <input 
            type="email" placeholder="OFFICIAL EMAIL" required 
            value={email} onChange={(e) => setEmail(e.target.value)} 
            className="auth-input"
          />
          <input 
            type="password" placeholder="CREATE SECURITY KEY" required 
            value={password} onChange={(e) => setPassword(e.target.value)} 
            className="auth-input"
          />
          <button type="submit" className="btn-register">Join the Grid</button>
        </form>
        
        <p className="auth-footer">
          Already a Team Member? 
          <button className="btn-text" onClick={() => navigate("/login")}>
            Access Paddock
          </button>
        </p>
      </div>
    </div>
  );
}