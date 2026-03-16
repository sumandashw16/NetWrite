require("dotenv").config();
const express  = require("express");
const http     = require("http");
const { Server } = require("socket.io");
const cors     = require("cors");
const mongoose = require("mongoose");
const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const User     = require("./models/User");

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();

// ✅ CHANGED: lock CORS to your frontend origin via env var.
// Falls back to * in dev if FRONTEND_URL isn't set.
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || "*";

app.use(cors({ origin: ALLOWED_ORIGIN, methods: ["GET", "POST"] }));
app.use(express.json());

// ─── Database ─────────────────────────────────────────────────────────────────

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => { console.error("❌ MongoDB Error:", err); process.exit(1); });

// ─── Auth Routes ──────────────────────────────────────────────────────────────

app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: "All fields are required." });

    if (await User.findOne({ email }))
      return res.status(400).json({ message: "User already exists!" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await new User({ username, email, password: hashedPassword }).save();
    res.status(201).json({ message: "User created successfully!" });

  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "All fields are required." });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "User not found!" });

    if (!await bcrypt.compare(password, user.password))
      return res.status(400).json({ message: "Invalid credentials!" });

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({ message: "Login successful!", token, username: user.username });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── HTTP + Socket Server ─────────────────────────────────────────────────────

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET", "POST"] }
});

// ✅ NEW: Socket auth middleware.
// Every connection must pass a valid JWT in the handshake auth object.
// Frontend should connect with: socket = io(URL, { auth: { token } })
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication required."));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = payload; // attach decoded user to socket for later use
    next();
  } catch {
    next(new Error("Invalid or expired token."));
  }
});

// ✅ NEW: track which room each socket has joined so we can validate emits.
// Map<socketId, roomId>
const socketRooms = new Map();

io.on("connection", (socket) => {
  console.log(`🔌 Connected: ${socket.user.username} (${socket.id})`);

  socket.on("join_room", (roomId) => {
    // ✅ NEW: only allow one active room per socket (keeps things clean)
    const prevRoom = socketRooms.get(socket.id);
    if (prevRoom) {
      socket.leave(prevRoom);
      socketRooms.delete(socket.id);
    }

    socket.join(roomId);
    socketRooms.set(socket.id, roomId);
    console.log(`📦 ${socket.user.username} joined room ${roomId}`);
  });

  socket.on("draw_event", (data) => {
    // ✅ NEW: verify this socket actually joined the room it's claiming.
    // Prevents a rogue client from injecting draw events into arbitrary rooms.
    const joinedRoom = socketRooms.get(socket.id);
    if (!joinedRoom || joinedRoom !== data.roomId) return;

    socket.to(data.roomId).emit("draw_event", data);
  });

  socket.on("clear_canvas", (data) => {
    // ✅ NEW: same room guard as draw_event
    const joinedRoom = socketRooms.get(socket.id);
    if (!joinedRoom || joinedRoom !== data.roomId) return;

    socket.to(data.roomId).emit("clear_canvas");
  });

  socket.on("disconnect", () => {
    socketRooms.delete(socket.id);
    console.log(`🔌 Disconnected: ${socket.user.username} (${socket.id})`);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// ✅ NEW: Graceful shutdown — closes DB and server cleanly on Ctrl+C or
// process kill. Prevents data corruption and zombie connections.
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down...`);
  server.close(() => console.log("✅ HTTP server closed"));
  await mongoose.connection.close();
  console.log("✅ MongoDB connection closed");
  process.exit(0);
};

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));