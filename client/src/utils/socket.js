import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const socket = io(BACKEND_URL, {
  auth: { token: localStorage.getItem("token") } // ✅ pass JWT on handshake
});

export default socket;