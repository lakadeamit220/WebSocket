import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

function App() {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [role, setRole] = useState("user");
  const [joined, setJoined] = useState(false);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.on("message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("adminMessage", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("adminEvent", (data) => {
      setMessages((prev) => [
        ...prev,
        { system: true, text: `${data.type} - ${data.username} (${data.room})` },
      ]);
    });

    return () => {
      socket.off("message");
      socket.off("adminMessage");
      socket.off("adminEvent");
    };
  }, []);

  const joinChat = () => {
    socket.emit("join", { username, role, room });
    setJoined(true);
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    socket.emit("chatMessage", message);
    setMessage("");
  };

  if (!joined) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Join Chat</h2>

        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <br /><br />

        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>

        <br /><br />

        {role === "user" && (
          <>
            <input
              placeholder="Room Name"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
            <br /><br />
          </>
        )}

        <button onClick={joinChat}>Join</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>{role === "admin" ? "Admin Dashboard" : `Room: ${room}`}</h2>

      <div style={{ height: 300, overflowY: "scroll", border: "1px solid gray", padding: 10 }}>
        {messages.map((msg, index) => (
          <div key={index}>
            {msg.system ? (
              <i>{msg.text}</i>
            ) : (
              <span>
                {msg.room && role === "admin" && <b>[{msg.room}] </b>}
                <b>{msg.username}:</b> {msg.text}
              </span>
            )}
          </div>
        ))}
      </div>

      <br />

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type message"
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default App;
