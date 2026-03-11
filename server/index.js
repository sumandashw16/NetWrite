require("dotenv").config()
const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const mongoose = require("mongoose")


const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully!"))
  .catch((err) => console.log("❌ MongoDB Connection Error:", err));

const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
    },
})

io.on("connection", (socket) => {
    console.log("user connected", socket.id);

    socket.on("join_room", (roomId) => {
    console.log("Room received:", roomId); 
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on("draw_event", (data) => {
        // Just forward the exact payload you received to everyone else in the room
        socket.to(data.roomId).emit("draw_event", data);
    });

    socket.on("disconnect", () => {
        console.log("user disconnected", socket.id);
    });

    socket.on("clear_canvas", (data) => {
        // Broadcast the clear command to the rest of the room
        socket.to(data.roomId).emit("clear_canvas");
    });
});

const PORT ="5000"
server.listen(PORT, () => {
    console.log("server running on PORT ", PORT);
});