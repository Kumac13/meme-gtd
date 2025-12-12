import React from "react";
import ReactMarkdown from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <article className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-serif prose-p:font-serif prose-p:leading-relaxed">
      <ReactMarkdown>{content}</ReactMarkdown>
    </article>
  );
};