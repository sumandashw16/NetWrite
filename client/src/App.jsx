import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Register from "./components/Register";
import Login from "./components/Login";
import WhiteboardArea from "./components/WhiteboardArea"; // Your relocated whiteboard code!

// 🛡️ THE BOUNCER: This component protects the whiteboard
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token"); // Check the vault for the VIP wristband
  
  if (!token) {
    // No token? Kick them to the login page.
    return <Navigate to="/login" replace />;
  }
  
  // They have the token! Let them see the whiteboard.
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes (Anyone can access these) */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes (You MUST be logged in to see this) */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <WhiteboardArea />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}