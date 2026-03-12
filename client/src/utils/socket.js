import { io } from "socket.io-client";

// Use the environment variable, or fallback to localhost just in case
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const socket = io(BACKEND_URL);

export default socket;