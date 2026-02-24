import React from "react";
import { io } from "socket.io-client";
import { useEffect, useState, useRef } from "react";
import "./App.css";

const SERVER_URL = "http://localhost:5003"; // Updated to match backend port

function ChatWindow({ initialUsername, initialRole, initialRoom }) {
  const [socket] = useState(() => io(SERVER_URL, { transports: ["websocket"] }));
  const [username, setUsername] = useState(initialUsername || "");
  const [role, setRole] = useState(initialRole || "user");
  const [room, setRoom] = useState(initialRoom || "room1");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [connError, setConnError] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.on("connect", () => {
      setIsConnected(true);
      setConnError(null);
      console.log("Socket connected:", socket.id);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("Socket disconnected");
      setJoined(false);
    });

    socket.on("connect_error", (err) => {
      console.error("connect_error:", err.message || err);
      setConnError(err.message || "Connection error");
    });

    socket.on("message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("adminMessage", (data) => {
      setMessages((prev) => [...prev, { ...data, isAdminMsg: true }]);
    });

    socket.on("adminEvent", (data) => {
      setMessages((prev) => [
        ...prev,
        {
          username: "ADMIN_EVENT",
          text: `📢 ${data.type} - ${data.username} (${data.room})`,
          timestamp: data.timestamp,
          type: "event",
          senderId: data.senderId,
        },
      ]);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("message");
      socket.off("adminMessage");
      socket.off("adminEvent");
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const doJoin = () => {
    if (!username.trim()) return alert("Enter a username");
    socket.emit("join", { username: username.trim(), role, room });
    setMessages((prev) => [
      ...prev,
      {
        username: "SYSTEM",
        text: `You joined ${role === "user" ? room : "ADMIN MONITOR"}`,
        timestamp: new Date().toLocaleTimeString(),
        type: "system",
        senderId: socket.id,
      },
    ]);
    setJoined(true);
  };

  const sendMessage = () => {
    if (!joined) return alert("Join first to send messages");
    if (!input.trim()) return;
    const localMsg = {
      username,
      room: role === "user" ? room : "BROADCAST",
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString(),
      type: "message",
      senderId: socket.id,
    };
    setMessages((prev) => [...prev, localMsg]);
    socket.emit("chatMessage", input.trim());
    setInput("");
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div>
          <strong>{username || "No name"}</strong>
          {" • "}
          <em>{role === "admin" ? "ADMIN" : room}</em>
        </div>
        <div>
          <span className={`status ${isConnected ? "connected" : "disconnected"}`}>
            {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
          </span>
        </div>
      </div>

      <div className="join-panel">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your name" />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        {role === "user" && (
          <select value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="room1">room1</option>
            <option value="room2">room2</option>
          </select>
        )}
        {!joined ? (
          <button onClick={doJoin} className="join-btn">Join</button>
        ) : (
          <button onClick={() => setJoined(false)} className="leave-btn">Leave</button>
        )}
      </div>

      {connError && <div className="conn-error">Connection error: {connError}</div>}

      <div className="messages-box">
        {messages.length === 0 ? (
          <div className="no-messages">No messages yet — follow the steps above to join.</div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`message ${msg.senderId === socket.id ? "you" : ""}`}>
              <div className="msg-meta">
                <span className="from">{msg.senderId === socket.id ? "You" : msg.username}</span>
                <span className="timestamp">{msg.timestamp}</span>
              </div>
              <div className="msg-content">{msg.text}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          disabled={!joined}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={!joined ? "Join first to send messages" : "Type a message..."}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
        />
        <button disabled={!joined} onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="app-container">
      <h1>Socket Room Chat — Friendly UI</h1>
      <div className="rooms-grid">
        <ChatWindow initialUsername="Amit" initialRole="user" initialRoom="room1" />
        <ChatWindow initialUsername="Rahul" initialRole="user" initialRoom="room2" />
        <ChatWindow initialUsername="SuperAdmin" initialRole="admin" />
      </div>
    </div>
  );
}
