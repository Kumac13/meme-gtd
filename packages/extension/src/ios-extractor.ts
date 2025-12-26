// iOS Share Extension entry point
// This file bundles extractArticle for use in WKWebView

import { extractArticle } from "./content/extractor";

// Expose to global scope for WKWebView JavaScript evaluation
(window as unknown as Record<string, unknown>).MemeGTDExtractor = {
  extractArticle: async function() {
    try {
      const result = await extractArticle(document, window.location.href);
      return JSON.stringify(result);
    } catch (e) {
      return JSON.stringify({
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }
};
