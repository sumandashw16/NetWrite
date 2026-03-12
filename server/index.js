require("dotenv").config()
const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const User = require("./models/User")


const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully!"))
  .catch((err) => console.log("❌ MongoDB Connection Error:", err));


//Authentication Process
app.post("/register", async (req, res) => {
    try {
        // 1. Grab the data the user typed into the frontend
        const { username, email, password } = req.body;

        // 2. Check if the email is already registered
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists!" });
        }

        // 3. Hash the password into gibberish (10 represents the security complexity)
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Create the new user and save them to MongoDB
        const newUser = new User({
            username,
            email,
            password: hashedPassword
        });
        
        await newUser.save();
        res.status(201).json({ message: "User created successfully!" });

    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


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