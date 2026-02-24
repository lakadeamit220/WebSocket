import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Socket Server Running 🚀");
});

// Track connected users: socketId -> { username, role, room }
const users = {};

// Helper: get active users list for admin
function getActiveUsers() {
  return Object.entries(users)
    .filter(([, u]) => u.role === "user")
    .map(([id, u]) => ({ socketId: id, username: u.username, room: u.room }));
}

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // ── JOIN ────────────────────────────────────────────────────────────────────
  socket.on("join", ({ username, role, room }) => {
    // Validate input
    if (!username || typeof username !== "string" || !username.trim()) return;
    if (!["user", "admin"].includes(role)) return;
    if (role === "user" && !["room1", "room2"].includes(room)) return;

    // Store user info
    users[socket.id] = {
      username: username.trim().slice(0, 32), // cap name at 32 chars
      role,
      room: role === "user" ? room : null,
    };

    if (role === "user") {
      socket.join(room);

      const joinMsg = {
        username: "SYSTEM",
        room,
        text: `✅ ${username} joined ${room}`,
        timestamp: new Date().toLocaleTimeString(),
        type: "join",
        senderId: "SYSTEM",
      };

      // Notify all users in the room
      io.to(room).emit("message", joinMsg);

      // Notify admin: room activity event
      io.to("ADMIN_MONITOR").emit("adminEvent", {
        type: "USER_JOINED",
        username,
        room,
        timestamp: joinMsg.timestamp,
        socketId: socket.id,
      });

      // Send updated online users list to admin
      io.to("ADMIN_MONITOR").emit("onlineUsers", getActiveUsers());
    }

    if (role === "admin") {
      socket.join("ADMIN_MONITOR");

      // On join, give admin current online users
      socket.emit("onlineUsers", getActiveUsers());
      console.log(`Admin "${username}" connected`);
    }

    console.log(`${username} (${role}) joined`, room || "ADMIN_MONITOR");
  });

  // ── CHAT MESSAGE ────────────────────────────────────────────────────────────
  socket.on("chatMessage", ({ text, targetRoom }) => {
    const user = users[socket.id];
    if (!user) return;

    // Guard: empty or too-long messages
    if (!text || typeof text !== "string" || !text.trim()) return;
    const safeText = text.trim().slice(0, 500); // cap at 500 chars

    const timestamp = new Date().toLocaleTimeString();

    if (user.role === "user") {
      const messageData = {
        username: user.username,
        room: user.room,
        text: safeText,
        timestamp,
        type: "message",
        senderId: socket.id,
      };

      // Deliver to everyone in the room (including sender → consistent state)
      io.to(user.room).emit("message", messageData);

      // Mirror to admin monitor
      io.to("ADMIN_MONITOR").emit("adminMessage", messageData);
    }

    if (user.role === "admin") {
      const safeTarget = ["room1", "room2", "ALL"].includes(targetRoom)
        ? targetRoom
        : "ALL";

      const adminMsg = {
        username: user.username || "ADMIN",
        room: safeTarget,
        text: safeText,
        timestamp,
        type: "adminBroadcast",
        senderId: socket.id,
      };

      if (safeTarget !== "ALL") {
        // Send to specific room only
        io.to(safeTarget).emit("message", adminMsg);
      } else {
        // Broadcast to all sockets EXCEPT the admin sender
        socket.broadcast.emit("message", adminMsg);
      }

      // Echo back to admin's own feed so they can see what they sent
      socket.emit("adminEcho", adminMsg);
    }
  });

  // ── DISCONNECT ───────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (!user) return;

    console.log(`${user.username} disconnected`);

    if (user.role === "user" && user.room) {
      const leaveMsg = {
        username: "SYSTEM",
        room: user.room,
        text: `❌ ${user.username} left ${user.room}`,
        timestamp: new Date().toLocaleTimeString(),
        type: "leave",
        senderId: "SYSTEM",
      };

      io.to(user.room).emit("message", leaveMsg);

      io.to("ADMIN_MONITOR").emit("adminEvent", {
        type: "USER_LEFT",
        username: user.username,
        room: user.room,
        timestamp: leaveMsg.timestamp,
        socketId: socket.id,
      });
    }

    delete users[socket.id];

    // Update admin with latest online users
    io.to("ADMIN_MONITOR").emit("onlineUsers", getActiveUsers());
  });
});

const PORT = 5003;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
