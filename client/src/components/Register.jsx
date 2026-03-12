import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault(); // Prevents the page from refreshing
    setError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Registration successful! Please log in.");
        navigate("/login"); // Send them to the login page
      } else {
        setError(data.message || "Registration failed");
      }
    } catch (err) {
      setError("Server error. Is the backend running?");
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h2>Sign Up for NetWrite</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}
      
      <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", width: "300px", margin: "0 auto" }}>
        <input 
          type="text" placeholder="Username" required 
          value={username} onChange={(e) => setUsername(e.target.value)} 
          style={{ marginBottom: "10px", padding: "8px" }}
        />
        <input 
          type="email" placeholder="Email" required 
          value={email} onChange={(e) => setEmail(e.target.value)} 
          style={{ marginBottom: "10px", padding: "8px" }}
        />
        <input 
          type="password" placeholder="Password" required 
          value={password} onChange={(e) => setPassword(e.target.value)} 
          style={{ marginBottom: "10px", padding: "8px" }}
        />
        <button type="submit" style={{ padding: "10px", cursor: "pointer" }}>Sign Up</button>
      </form>
      
      <p>Already have an account? <button onClick={() => navigate("/login")}>Login</button></p>
    </div>
  );
}