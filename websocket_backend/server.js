import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
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
    users[socket.id] = { username, role, room };

    if (role === "user") {
      socket.join(room);

      // Notify room
      socket.to(room).emit("message", {
        system: true,
        text: `${username} joined ${room}`,
      });

      // Notify admin
      io.to("ADMIN_MONITOR").emit("adminEvent", {
        type: "USER_JOINED",
        username,
        room,
      });
    }

    if (role === "admin") {
      socket.join("ADMIN_MONITOR");
      console.log("Admin connected");
    }
  });

  // USER MESSAGE
  socket.on("chatMessage", (text) => {
    const user = users[socket.id];
    if (!user) return;

    if (user.role === "user") {
      const messageData = {
        username: user.username,
        room: user.room,
        text,
        timestamp: new Date(),
      };

      // Send to room only
      io.to(user.room).emit("message", messageData);

      // Send to admin monitor
      io.to("ADMIN_MONITOR").emit("adminMessage", messageData);
    }

    if (user.role === "admin") {
      // Admin broadcast to all rooms
      io.emit("message", {
        username: "ADMIN",
        text,
        room: "ALL",
        timestamp: new Date(),
      });
    }
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (!user) return;

    if (user.role === "user") {
      socket.to(user.room).emit("message", {
        system: true,
        text: `${user.username} left the room`,
      });

      io.to("ADMIN_MONITOR").emit("adminEvent", {
        type: "USER_LEFT",
        username: user.username,
        room: user.room,
      });
    }

    delete users[socket.id];
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
