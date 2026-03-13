import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css"; // 🏎️ Import the new styling

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);
        navigate("/"); 
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("Server error. Is the backend running?");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2 className="auth-title">ACCESS PORTAL</h2>
        
        {error && <div className="error-badge">{error}</div>}
        
        <form onSubmit={handleLogin} className="auth-form">
          <input 
            type="email" placeholder="USER EMAIL" required 
            value={email} onChange={(e) => setEmail(e.target.value)} 
            className="auth-input"
          />
          <input 
            type="password" placeholder="SECURITY KEY" required 
            value={password} onChange={(e) => setPassword(e.target.value)} 
            className="auth-input"
          />
          <button type="submit" className="btn-login">Start Engine</button>
        </form>
        
        <p className="auth-footer">
          New Team Member? 
          <button className="btn-text" onClick={() => navigate("/register")}>
            Apply for Entry
          </button>
        </p>
      </div>
    </div>
  );
}