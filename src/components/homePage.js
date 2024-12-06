import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";

const ChatComponent = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { sender: "user", text: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const data = {
      contents: [
        {
          parts: [
            {
              text: input,
            },
          ],
        },
      ],
    };

    try {
      const response = await axios.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=AIzaSyAZEcBeZiULudWy4KodjiExYsHFy6Rl0Ok", // Replace YOUR_API_KEY with your actual Google Gemini API Key
        data,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const reply =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No response received.";
      setMessages([...newMessages, { sender: "assistant", text: reply }]);
    } catch (error) {
      console.error("Error fetching response:", error);
      setMessages([
        ...newMessages,
        { sender: "assistant", text: "Error: Unable to fetch a response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex flex-column vh-100 bg-gradient text-light" style={{ backgroundColor: "#2c2f33" }}>
      <header className="bg-primary text-white text-center py-4 shadow">
        <h1 className="display-7">Boobalan's AI Chat</h1>
      </header>

      <main className="flex-grow-1 d-flex flex-column align-items-center justify-content-between p-3">
        <div
          className="chat-box w-100 rounded p-4 bg-light shadow"
          style={{ maxHeight: "70vh", overflowY: "auto", border: "1px solid #ccc" }}
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`d-flex ${
                msg.sender === "user"
                  ? "justify-content-end"
                  : "justify-content-start"
              } mb-3`}
            >
              <div
                className={`p-3 rounded shadow-sm text-break ${
                  msg.sender === "user"
                    ? "bg-primary text-white"
                    : "bg-secondary text-white"
                }`}
                style={{ maxWidth: "70%", fontSize: "1.1rem" }}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-center text-primary">
              <span>Generating response...</span>
            </div>
          )}
        </div>

        <div className="input-group mt-3 w-100 shadow">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="form-control bg-light text-dark border-secondary"
            placeholder="Type a message..."
            style={{ borderRadius: "20px 0 0 20px", padding: "15px" }}
          />
          <button
            onClick={handleSendMessage}
            disabled={loading}
            className="btn btn-primary"
            style={{ borderRadius: "0 20px 20px 0", padding: "15px 30px" }}
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </main>

      <footer className="bg-dark text-white text-center py-3 shadow-lg mt-auto">
        <small className="fw-bold">&copy; 2024 Boobalan</small>
      </footer>
    </div>
  );
};

export default ChatComponent;
