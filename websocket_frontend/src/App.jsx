import React, { useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import "./App.css";

const SERVER_URL = "http://localhost:5003";

// ─── Utility ────────────────────────────────────────────────────────────────
function createSocket() {
  return io(SERVER_URL, { transports: ["websocket"], autoConnect: true });
}

// ─── USER PANEL ─────────────────────────────────────────────────────────────
function UserPanel({ defaultName, defaultRoom, accentColor }) {
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [connError, setConnError] = useState(null);
  const [username, setUsername] = useState(defaultName);
  const [room, setRoom] = useState(defaultRoom);
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mySocketId, setMySocketId] = useState(null);

  // Initialise socket once
  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setConnError(null);
      setMySocketId(socket.id);
    });
    socket.on("disconnect", () => {
      setIsConnected(false);
      setJoined(false);
    });
    socket.on("connect_error", (err) => {
      setConnError(err.message || "Cannot connect to server");
    });

    // All room messages (including admin broadcasts) arrive here
    socket.on("message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleJoin = () => {
    if (!username.trim()) return alert("Please enter your name first.");
    socketRef.current.emit("join", {
      username: username.trim(),
      role: "user",
      room,
    });
    setMySocketId(socketRef.current.id);
    setJoined(true);
  };

  const handleLeave = () => {
    // Mark as not joined immediately so UI updates right away
    setJoined(false);
    setMessages([]);
    // Disconnect triggers server-side cleanup (USER_LEFT event), then reconnect
    socketRef.current.disconnect();
    socketRef.current.connect();
  };

  const sendMessage = useCallback(() => {
    if (!joined || !input.trim()) return;
    const text = input.trim().slice(0, 500); // client-side cap matches server
    socketRef.current.emit("chatMessage", { text });
    setInput("");
  }, [joined, input]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="panel user-panel" style={{ "--accent": accentColor }}>
      {/* ── Header ── */}
      <div className="panel-header" style={{ background: accentColor }}>
        <div className="panel-title">
          <span className="role-badge user-badge">👤 USER</span>
          <span className="panel-name">{username || "—"}</span>
        </div>
        <span className={`conn-dot ${isConnected ? "on" : "off"}`}>
          {isConnected ? "● Connected" : "● Offline"}
        </span>
      </div>

      {/* ── How-to guide ── */}
      {!joined && (
        <div className="guide-box">
          <div className="guide-title">📋 How to start chatting</div>
          <ol className="guide-steps">
            <li>Your name is pre-filled. You can change it if you like.</li>
            <li>Choose a room — <strong>Room 1</strong> or <strong>Room 2</strong>.</li>
            <li>Click <strong>Join Room</strong> to connect.</li>
            <li>Type a message in the box below and press <kbd>Enter</kbd> or click <strong>Send</strong>.</li>
          </ol>
          <div className="guide-note">
            ℹ️ You will only see messages from users in the <em>same room</em> as you.
            Admin can message you from their panel.
          </div>
        </div>
      )}

      {/* ── Join controls ── */}
      <div className="join-bar">
        <input
          className="join-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Your name"
          disabled={joined}
        />
        <select
          className="join-select"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          disabled={joined}
        >
          <option value="room1">🏠 Room 1</option>
          <option value="room2">🏡 Room 2</option>
        </select>
        {!joined ? (
          <button
            className="btn btn-join"
            onClick={handleJoin}
            disabled={!isConnected}
          >
            Join Room
          </button>
        ) : (
          <button className="btn btn-leave" onClick={handleLeave}>
            Leave
          </button>
        )}
      </div>

      {/* ── Room indicator (shown after join) ── */}
      {joined && (
        <div className="room-indicator">
          <span>📍 You are in <strong>{room === "room1" ? "Room 1" : "Room 2"}</strong></span>
          <span className="room-tip">Messages below are from your room</span>
        </div>
      )}

      {/* ── Error banner ── */}
      {connError && (
        <div className="error-banner">
          ⚠️ {connError} — Is the backend running on port 5003?
        </div>
      )}

      {/* ── Messages ── */}
      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="empty-state">
            {joined
              ? "No messages yet. Say hello! 👋"
              : "Join a room to start chatting."}
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.senderId === mySocketId;
            const isSystem = msg.type === "join" || msg.type === "leave";
            const isAdmin = msg.type === "adminBroadcast";

            if (isSystem) {
              return (
                <div key={i} className="msg-system">
                  {msg.text}
                </div>
              );
            }
            if (isAdmin) {
              return (
                <div key={i} className="msg-bubble msg-admin-broadcast">
                  <div className="bubble-meta">
                    <span className="bubble-author admin-label">📢 ADMIN</span>
                    <span className="bubble-time">{msg.timestamp}</span>
                  </div>
                  <div className="bubble-text">{msg.text}</div>
                </div>
              );
            }
            return (
              <div
                key={i}
                className={`msg-bubble ${isMe ? "msg-mine" : "msg-other"}`}
              >
                <div className="bubble-meta">
                  <span className="bubble-author">
                    {isMe ? "You" : msg.username}
                  </span>
                  <span className="bubble-time">{msg.timestamp}</span>
                </div>
                <div className="bubble-text">{msg.text}</div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="input-bar">
        <input
          className="msg-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={joined ? `Message in ${room === "room1" ? "Room 1" : "Room 2"}…` : "Join a room first…"}
          disabled={!joined}
        />
        <button
          className="btn btn-send"
          style={{ background: accentColor }}
          onClick={sendMessage}
          disabled={!joined}
        >
          Send ➤
        </button>
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────
function AdminPanel() {
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [connError, setConnError] = useState(null);
  const [username] = useState("Admin");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [targetRoom, setTargetRoom] = useState("ALL");
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setConnError(null);
    });
    socket.on("disconnect", () => {
      setIsConnected(false);
      setJoined(false);
    });
    socket.on("connect_error", (err) => {
      setConnError(err.message || "Cannot connect to server");
    });

    // Messages from users that admin monitors
    socket.on("adminMessage", (data) => {
      setMessages((prev) => [
        ...prev,
        { ...data, _display: "userMsg" },
      ]);
    });

    // Join/Leave events
    socket.on("adminEvent", (data) => {
      setMessages((prev) => [
        ...prev,
        {
          text:
            data.type === "USER_JOINED"
              ? `✅ ${data.username} joined ${data.room}`
              : `❌ ${data.username} left ${data.room}`,
          timestamp: data.timestamp,
          _display: "event",
          type: data.type,
        },
      ]);
    });

    // Echo of admin's own sent message
    socket.on("adminEcho", (data) => {
      setMessages((prev) => [...prev, { ...data, _display: "adminSent" }]);
    });

    // Live online users list
    socket.on("onlineUsers", (list) => {
      setOnlineUsers(list);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleJoin = () => {
    socketRef.current.emit("join", { username, role: "admin" });
    setJoined(true);
  };

  const sendMessage = useCallback(() => {
    if (!joined || !input.trim()) return;
    const text = input.trim().slice(0, 500); // client-side cap matches server
    socketRef.current.emit("chatMessage", { text, targetRoom });
    setInput("");
  }, [joined, input, targetRoom]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="panel admin-panel">
      {/* ── Header ── */}
      <div className="panel-header admin-header">
        <div className="panel-title">
          <span className="role-badge admin-badge">🛡️ ADMIN</span>
          <span className="panel-name">Monitor &amp; Control</span>
        </div>
        <span className={`conn-dot ${isConnected ? "on" : "off"}`}>
          {isConnected ? "● Connected" : "● Offline"}
        </span>
      </div>

      {/* ── How-to guide ── */}
      {!joined && (
        <div className="guide-box guide-admin">
          <div className="guide-title">📋 Admin Panel Guide</div>
          <ol className="guide-steps">
            <li>Click <strong>Connect as Admin</strong> to enter monitor mode.</li>
            <li>You will see <em>all messages</em> from both rooms in real-time.</li>
            <li>Choose a target (Room 1, Room 2, or All Rooms) before sending.</li>
            <li>Type your message and click <strong>Send</strong> — it will be delivered to the selected room(s).</li>
          </ol>
          <div className="guide-note">
            ℹ️ Admin messages appear in <strong>purple</strong> in the user panels.
            You can monitor who is online and in which room.
          </div>
        </div>
      )}

      {/* ── Join button ── */}
      {!joined ? (
        <div className="join-bar">
          <button
            className="btn btn-admin-join"
            onClick={handleJoin}
            disabled={!isConnected}
          >
            🔌 Connect as Admin
          </button>
        </div>
      ) : (
        <>
          {/* ── Online users ── */}
          <div className="online-users-box">
            <div className="ou-title">👥 Online Users ({onlineUsers.length})</div>
            {onlineUsers.length === 0 ? (
              <div className="ou-empty">No users connected yet</div>
            ) : (
              <div className="ou-list">
                {onlineUsers.map((u, i) => (
                  <div key={i} className="ou-item">
                    <span className="ou-name">{u.username}</span>
                    <span className={`ou-room ${u.room === "room1" ? "room1" : "room2"}`}>
                      {u.room === "room1" ? "Room 1" : "Room 2"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Error banner ── */}
      {connError && (
        <div className="error-banner">
          ⚠️ {connError} — Is the backend running on port 5003?
        </div>
      )}

      {/* ── Messages (monitor feed) ── */}
      <div className="messages-area">
        {!joined ? (
          <div className="empty-state">Connect as admin to see the live message feed.</div>
        ) : messages.length === 0 ? (
          <div className="empty-state">Waiting for activity… 👀</div>
        ) : (
          messages.map((msg, i) => {
            if (msg._display === "event") {
              return (
                <div key={i} className="msg-system">
                  {msg.text}
                  <span className="bubble-time" style={{ marginLeft: 8 }}>
                    {msg.timestamp}
                  </span>
                </div>
              );
            }
            if (msg._display === "adminSent") {
              return (
                <div key={i} className="msg-bubble msg-admin-sent">
                  <div className="bubble-meta">
                    <span className="bubble-author admin-label">
                      📢 You → {msg.room === "ALL" ? "All Rooms" : msg.room}
                    </span>
                    <span className="bubble-time">{msg.timestamp}</span>
                  </div>
                  <div className="bubble-text">{msg.text}</div>
                </div>
              );
            }
            // userMsg
            return (
              <div key={i} className="msg-bubble msg-monitor">
                <div className="bubble-meta">
                  <span className="bubble-author">{msg.username}</span>
                  <span className={`room-tag ${msg.room === "room1" ? "room1" : "room2"}`}>
                    {msg.room === "room1" ? "Room 1" : "Room 2"}
                  </span>
                  <span className="bubble-time">{msg.timestamp}</span>
                </div>
                <div className="bubble-text">{msg.text}</div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Admin input ── */}
      {joined && (
        <div className="admin-input-bar">
          <div className="target-row">
            <label className="target-label">📣 Send to:</label>
            <select
              className="target-select"
              value={targetRoom}
              onChange={(e) => setTargetRoom(e.target.value)}
            >
              <option value="ALL">🌐 All Rooms</option>
              <option value="room1">🏠 Room 1 only</option>
              <option value="room2">🏡 Room 2 only</option>
            </select>
          </div>
          <div className="input-bar">
            <input
              className="msg-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Broadcast to ${targetRoom === "ALL" ? "all rooms" : targetRoom}…`}
            />
            <button className="btn btn-send btn-admin-send" onClick={sendMessage}>
              Send ➤
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div className="app-root">
      {/* Title */}
      <header className="app-header">
        <h1 className="app-title">⚡ WebSocket Chat Demo</h1>
        <p className="app-subtitle">
          2 users · 2 rooms · 1 admin — real-time messaging via Socket.IO
        </p>
        <div className="legend">
          <span className="legend-item user1">👤 User 1 — Room 1</span>
          <span className="legend-item user2">👤 User 2 — Room 2</span>
          <span className="legend-item adminl">🛡️ Admin — monitors both</span>
        </div>
      </header>

      {/* Panels */}
      <main className="panels-grid">
        <UserPanel
          panelId="user1"
          defaultName="Amit"
          defaultRoom="room1"
          accentColor="#4f46e5"
        />
        <UserPanel
          panelId="user2"
          defaultName="Rahul"
          defaultRoom="room2"
          accentColor="#0891b2"
        />
        <AdminPanel />
      </main>

      <footer className="app-footer">
        Backend: <code>localhost:5003</code> · Frontend: Vite + React + Socket.IO
      </footer>
    </div>
  );
}
