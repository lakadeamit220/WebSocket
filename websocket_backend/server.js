import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"],
  },
});

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Socket Server Running 🚀");
});

const users = {}; // socketId -> { username, role, room }

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // JOIN EVENT
  socket.on("join", ({ username, role, room }) => {
    users[socket.id] = { username, role, room: role === "user" ? room : null };
    console.log(`${username} (${role}) joined`, room || "ADMIN");

    if (role === "user") {
      socket.join(room);

      const joinMsg = {
        username: "SYSTEM",
        room,
        text: `✅ ${username} joined ${room}`,
        timestamp: new Date().toLocaleTimeString(),
        type: "join",
        senderId: socket.id,
      };

      io.to(room).emit("message", joinMsg);
      io.to("ADMIN_MONITOR").emit("adminEvent", {
        type: "USER_JOINED",
        username,
        room,
        timestamp: joinMsg.timestamp,
        senderId: socket.id,
      });
    }

    if (role === "admin") {
      socket.join("ADMIN_MONITOR");
      console.log("Admin connected");
    }
  });

  // CHAT MESSAGE EVENT
  socket.on("chatMessage", (text) => {
    const user = users[socket.id];
    if (!user) return;

    if (user.role === "user") {
      const messageData = {
        username: user.username,
        room: user.room,
        text,
        timestamp: new Date().toLocaleTimeString(),
        type: "message",
        senderId: socket.id,
      };

      io.to(user.room).emit("message", messageData);
      io.to("ADMIN_MONITOR").emit("adminMessage", messageData);
    }

    if (user.role === "admin") {
      const adminMsg = {
        username: user.username || "ADMIN",
        text,
        room: "BROADCAST",
        timestamp: new Date().toLocaleTimeString(),
        type: "message",
        senderId: socket.id,
      };
      io.emit("message", adminMsg);
    }
  });

  // DISCONNECT EVENT
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (!user) return;

    if (user.role === "user" && user.room) {
      io.to(user.room).emit("message", {
        username: "SYSTEM",
        room: user.room,
        text: `❌ ${user.username} disconnected`,
        timestamp: new Date().toLocaleTimeString(),
        type: "leave",
        senderId: socket.id,
      });

      io.to("ADMIN_MONITOR").emit("adminEvent", {
        type: "USER_LEFT",
        username: user.username,
        room: user.room,
        timestamp: new Date().toLocaleTimeString(),
        senderId: socket.id,
      });
    }

    delete users[socket.id];
    console.log(`${user.username} disconnected`);
  });
});

const PORT = 5003; // Changed port to 5003
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
