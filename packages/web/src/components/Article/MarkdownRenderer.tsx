import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Cleanse content before rendering
  const cleansedContent = useMemo(() => {
    return content
      // Remove block IDs: {#block-123}
      .replace(/\{#block-\d+\}/g, "")
      // Remove horizontal rules if they are excessive (optional, but standard markdown hr is --- or ***)
      // This regex might be too aggressive if we want SOME dividers, but user asked to suppress them.
      // Or we can hide them via CSS.
      // Let stick to CSS for hr suppression as it safer than modifying markdown structure heavily.
      ; 
  }, [content]);

  return (
    <article className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-serif prose-p:font-serif prose-p:leading-relaxed prose-hr:opacity-0 prose-hr:my-2 prose-hr:border-transparent">
      <ReactMarkdown>{cleansedContent}</ReactMarkdown>
    </article>
  );
};
