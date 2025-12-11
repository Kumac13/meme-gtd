import { extractArticle } from "./extractor";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SAVE_ARTICLE") {
    (async () => {
      try {
        const article = await extractArticle(document, window.location.href);
        // Send to background to save
        chrome.runtime.sendMessage({
          action: "SAVE_TO_API",
          payload: article
        }, (response) => {
           if (response && response.success) {
               showNotification("Saved!");
               sendResponse({ success: true });
           } else {
               showNotification("Error saving: " + (response?.error || "Unknown"));
               sendResponse({ success: false, error: response?.error });
           }
        });
      } catch (error: any) {
        console.error("Extraction error:", error);
        showNotification("Extraction failed");
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open
  }
});

function showNotification(message: string) {
  const div = document.createElement("div");
  div.style.position = "fixed";
  div.style.top = "0";
  div.style.left = "0";
  div.style.width = "100%";
  div.style.backgroundColor = "#4caf50";
  div.style.color = "white";
  div.style.textAlign = "center";
  div.style.padding = "10px";
  div.style.zIndex = "999999";
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => {
    div.remove();
  }, 3000);
}
