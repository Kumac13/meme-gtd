chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SAVE_TO_API") {
    (async () => {
      try {
        const result = await chrome.storage.sync.get("apiUrl");
        const apiUrl = result.apiUrl || "http://localhost:3000"; // Default to 3000 if not set

        const response = await fetch(`${apiUrl}/api/articles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
              title: request.payload.title,
              bodyMd: request.payload.content,
              originalUrl: request.payload.originalUrl,
              siteName: request.payload.siteName
          })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Server error: ${error}`);
        }

        const data = await response.json();
        sendResponse({ success: true, data });
      } catch (error: unknown) {
        console.error("API error:", error);
        const message = error instanceof Error ? error.message : String(error);
        sendResponse({ success: false, error: message });
      }
    })();
    return true;
  }
});