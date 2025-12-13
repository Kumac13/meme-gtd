import { describe, it, expect } from "vitest";
import { extractArticle } from "./extractor";
import { JSDOM } from "jsdom";

describe("Extractor", () => {
  it("should extract article content and convert to markdown with block IDs", async () => {
    const html = `
      <html>
        <body>
          <h1>Article Title</h1>
          <p>This is a paragraph.</p>
          <div class="ad">Advertisement</div>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </body>
      </html>
    `;
    const dom = new JSDOM(html, { url: "https://example.com/article" });
    // Mock Readability/Turndown environment if needed, or rely on implementation
    
    // Since we haven implemented extractor yet, this test defines expected behavior.
    // Note: implementation needs to handle JSDOM Document
    
    const result = await extractArticle(dom.window.document, "https://example.com/article");

    expect(result.title).toBe("Article Title");
    expect(result.content).toContain("# Article Title {#block-");
    expect(result.content).toContain("This is a paragraph. {#block-");
    expect(result.content).not.toContain("Advertisement");
    expect(result.content).toContain("- Item 1");
  });
});
