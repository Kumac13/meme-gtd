import React from "react";
// import ReactMarkdown from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Use a library to render markdown. For now, simple pre-wrap.
  // Need to handle custom ID format {#id} if possible, or just render as is.
  return <div className="prose max-w-none whitespace-pre-wrap">{content}</div>;
};
