import React, { useState } from "react";
import { createRoot } from "react-dom/client";

const Popup = () => {
  const [status, setStatus] = useState<string>("");

  const handleSave = async () => {
    setStatus("Saving...");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab.id) {
        try {
            chrome.tabs.sendMessage(tab.id, { action: "SAVE_ARTICLE" }, (response) => {
                if (chrome.runtime.lastError) {
                    setStatus("Error: " + chrome.runtime.lastError.message);
                } else if (response && response.success) {
                    setStatus("Saved!");
                } else {
                    setStatus("Error: " + (response?.error || "Unknown error"));
                }
            });
        } catch (e: any) {
            setStatus("Error: " + e.message);
        }
    } else {
        setStatus("No active tab");
    }
  };

  return (
    <div style={{ width: "200px", padding: "10px", textAlign: "center" }}>
      <h2>Meme GTD Saver</h2>
      <button onClick={handleSave} style={{ padding: "10px 20px", cursor: "pointer" }}>
        Save Article
      </button>
      {status && <p>{status}</p>}
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
    const root = createRoot(container);
    root.render(<Popup />);
}
