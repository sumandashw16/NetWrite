const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const app = express()
app.use(cors())

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
        // console.log("Draw received:", data); 
        const { roomId, x, y } = data;
        socket.to(roomId).emit("draw_event", { x, y });
    });

    socket.on("disconnect", () => {
        console.log("user disconnected", socket.id);
    });
});

const PORT ="5000"
server.listen(PORT, () => {
    console.log("server running on PORT ", PORT);
});