import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

export interface ExtractedArticle {
  title: string;
  content: string; // Markdown
  siteName?: string;
  originalUrl: string;
}

export async function extractArticle(document: Document, url: string): Promise<ExtractedArticle> {
  // clone document to avoid modifying the actual page significantly (though Readability does modify)
  const docClone = document.cloneNode(true) as Document;
  const reader = new Readability(docClone);
  const article = reader.parse();

  if (!article) {
    throw new Error("Failed to parse article");
  }

  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  // Custom rule to add block IDs
  let blockCounter = 0;
  
  // Inject IDs into the HTML *before* Markdown conversion
  // article.content is an HTML string of the extracted content.
  const parser = new DOMParser();
  
  const articleDoc = parser.parseFromString(article.content, "text/html");
  const blocks = articleDoc.querySelectorAll("p, h1, h2, h3, h4, h5, h6");
  
  blocks.forEach((block, index) => {
    block.setAttribute("data-block-id", `block-${index}`);
  });

  // Override specific rules to include ID
  ["p", "h1", "h2", "h3", "h4", "h5", "h6"].forEach(tag => {
    turndownService.addRule(tag, {
      filter: tag,
      replacement: (content, node) => {
        const id = (node as Element).getAttribute("data-block-id");
        const hashes = {
          h1: "# ", h2: "## ", h3: "### ", h4: "#### ", h5: "##### ", h6: "###### ",
          p: ""
        };
        const prefix = hashes[tag as keyof typeof hashes] || "";
        // Only append ID if it exists
        const suffix = id ? ` {#${id}}` : "";
        return `\n\n${prefix}${content}${suffix}\n\n`;
      }
    });
  });
  
  const markdown = turndownService.turndown(articleDoc.body);

  return {
    title: article.title,
    content: markdown,
    siteName: article.siteName,
    originalUrl: url
  };
}
