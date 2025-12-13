import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

const Options = () => {
  const [apiUrl, setApiUrl] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    // Load saved API URL
    chrome.storage.sync.get("apiUrl", (data) => {
      setApiUrl(data.apiUrl || "http://localhost:3000"); // Default to 3000
    });
  }, []);

  const saveOptions = () => {
    chrome.storage.sync.set({ apiUrl }, () => {
      setMessage("Options saved!");
      setTimeout(() => setMessage(""), 2000);
    });
  };

  return (
    <div style={{ padding: "20px", width: "400px" }}>
      <h1>Meme GTD Saver Options</h1>
      <div>
        <label htmlFor="apiUrl">API URL:</label>
        <input
          type="text"
          id="apiUrl"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          style={{ width: "100%", padding: "8px", margin: "10px 0", boxSizing: "border-box" }}
        />
      </div>
      <button onClick={saveOptions} style={{ padding: "10px 20px", cursor: "pointer" }}>
        Save
      </button>
      {message && <p style={{ color: "green", marginTop: "10px" }}>{message}</p>}
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}
