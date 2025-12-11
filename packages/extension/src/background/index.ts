chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SAVE_TO_API") {
    (async () => {
      try {
        const response = await fetch("http://localhost:3000/api/articles", {
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
      } catch (error: any) {
        console.error("API error:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});
