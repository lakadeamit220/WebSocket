import React from "react";
import { io } from "socket.io-client";
import { useEffect, useState } from "react";

const SERVER_URL = "http://localhost:5000";

function ChatWindow({ username, role, room }) {
  const [socket] = useState(() => io(SERVER_URL));
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    socket.emit("join", { username, role, room });

    socket.on("message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("adminMessage", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("adminEvent", (data) => {
      setMessages((prev) => [
        ...prev,
        {
          system: true,
          text: `${data.type} - ${data.username} (${data.room})`,
        },
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, [socket, username, role, room]);

  const sendMessage = () => {
    if (!input.trim()) return;
    socket.emit("chatMessage", input);
    setInput("");
  };

  return (
    <div
      style={{
        border: "2px solid black",
        padding: 10,
        width: "48%",
        marginBottom: 20,
      }}
    >
      <h3>
        {role === "admin"
          ? "👑 ADMIN"
          : `👤 ${username} (${room})`}
      </h3>

      <div
        style={{
          height: 200,
          overflowY: "auto",
          border: "1px solid gray",
          padding: 5,
          marginBottom: 10,
        }}
      >
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.system ? (
              <i>{msg.text}</i>
            ) : (
              <span>
                {msg.room && role === "admin" && (
                  <b>[{msg.room}] </b>
                )}
                <b>{msg.username}:</b> {msg.text}
              </span>
            )}
          </div>
        ))}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default function App() {
  return (
    <div style={{ padding: 20 }}>
      <h2>🧪 Socket Room + Admin Simulation</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4%" }}>
        <ChatWindow username="Amit" role="user" room="room1" />
        <ChatWindow username="Rahul" role="user" room="room2" />
        <ChatWindow username="Priya" role="user" room="room1" />
        <ChatWindow username="SuperAdmin" role="admin" />
      </div>
    </div>
  );
}
