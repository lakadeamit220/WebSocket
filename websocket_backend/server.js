import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5001",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("WebSocket server is running 🚀");
});

// Socket connection
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Listen for messages
  socket.on("message", (data) => {
    console.log(`Message received: ${data}`);

    // Broadcast to all connected clients
    io.emit("message", data);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
