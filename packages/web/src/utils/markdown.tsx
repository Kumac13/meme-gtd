/**
 * Markdown rendering utilities for meme-gtd Web UI
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { Components } from 'react-markdown';

/**
 * Default markdown components configuration with Tailwind CSS styling
 */
const defaultComponents: Components = {
  // Headings
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-bold mt-4 mb-2 text-gray-900">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-bold mt-3 mb-2 text-gray-900">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-sm font-bold mt-2 mb-1 text-gray-900">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-xs font-bold mt-2 mb-1 text-gray-900">{children}</h6>
  ),

  // Paragraphs and text
  p: ({ children }) => <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-700">{children}</em>,

  // Lists
  ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1 text-gray-700">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1 text-gray-700">{children}</ol>,
  li: ({ children }) => <li className="ml-4">{children}</li>,

  // Links
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-github-green-600 hover:text-github-green-800 underline break-words"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),

  // Code blocks
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4">
        {children}
      </code>
    );
  },

  // Block quotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 py-2 mb-4 text-gray-600 italic">
      {children}
    </blockquote>
  ),

  // Tables (GFM)
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  tbody: ({ children }) => <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 text-sm text-gray-700 border border-gray-300">{children}</td>
  ),

  // Horizontal rule
  hr: () => <hr className="my-6 border-gray-300" />,
};

export interface MarkdownRendererProps {
  /**
   * Markdown content to render
   */
  content: string;
  /**
   * Optional custom components to override defaults
   */
  components?: Components;
  /**
   * Optional CSS class name for the wrapper div
   */
  className?: string;
}

/**
 * Render markdown content with GFM support and Tailwind CSS styling
 * @param props Markdown renderer props
 * @returns JSX element with rendered markdown
 */
export function MarkdownRenderer({ content, components, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{ ...defaultComponents, ...components }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Sanitize markdown content (basic sanitization)
 * Note: react-markdown already provides XSS protection by default
 * @param content Raw markdown content
 * @returns Sanitized markdown content
 */
export function sanitizeMarkdown(content: string): string {
  // react-markdown handles XSS protection, but we can do basic cleanup
  return content.trim();
}

/**
 * Extract plain text from markdown (strip formatting)
 * @param markdown Markdown content
 * @returns Plain text without markdown formatting
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.+?)\*/g, '$1') // Remove italic
    .replace(/_(.+?)_/g, '$1') // Remove italic (underscore)
    .replace(/`(.+?)`/g, '$1') // Remove inline code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links (keep text)
    .replace(/!\[.*?\]\(.+?\)/g, '') // Remove images
    .replace(/>\s+/g, '') // Remove blockquotes
    .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\s*\d+\.\s+/gm, '') // Remove ordered list markers
    .trim();
}

/**
 * Truncate markdown content to a specified length (for previews)
 * @param markdown Markdown content
 * @param maxLength Maximum length in characters
 * @returns Truncated plain text with ellipsis if needed
 */
export function truncateMarkdown(markdown: string, maxLength: number = 100): string {
  const plainText = markdownToPlainText(markdown);
  if (plainText.length <= maxLength) {
    return plainText;
  }
  return plainText.slice(0, maxLength).trim() + '...';
}

/**
 * Extract first line from markdown content
 * @param markdown Markdown content
 * @param maxLength Optional maximum length for truncation
 * @returns First line of markdown (text before first \n)
 */
export function extractFirstLine(markdown: string, maxLength?: number): string {
  const firstLine = markdown.split('\n')[0] || '';
  if (maxLength && firstLine.length > maxLength) {
    return firstLine.slice(0, maxLength).trim() + '...';
  }
  return firstLine;
}

/**
 * Inline markdown renderer for list/card previews
 * Renders markdown inline without block-level margins
 * @param props Component props with content string
 * @returns JSX element with inline-rendered markdown
 */
export function InlineMarkdownRenderer({ content }: { content: string }) {
  const inlineComponents: Components = {
    p: ({ children }) => <span className="text-gray-900">{children}</span>,
    h1: ({ children }) => <strong className="text-base font-semibold text-gray-900">{children}</strong>,
    h2: ({ children }) => <strong className="text-base font-semibold text-gray-900">{children}</strong>,
    h3: ({ children }) => <strong className="text-sm font-semibold text-gray-900">{children}</strong>,
    h4: ({ children }) => <strong className="text-sm font-semibold text-gray-900">{children}</strong>,
    h5: ({ children }) => <strong className="text-xs font-semibold text-gray-900">{children}</strong>,
    h6: ({ children }) => <strong className="text-xs font-semibold text-gray-900">{children}</strong>,
    strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
    em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
    code: ({ children }) => (
      <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-xs font-mono">
        {children}
      </code>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-github-green-600 hover:text-github-green-800 underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    ul: ({ children }) => <span>{children}</span>,
    ol: ({ children }) => <span>{children}</span>,
    li: ({ children }) => <span className="mr-2">{children}</span>,
    blockquote: ({ children }) => <span className="italic text-gray-600">{children}</span>,
    hr: () => null,
    table: () => null,
    thead: () => null,
    tbody: () => null,
    tr: () => null,
    th: () => null,
    td: () => null,
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={inlineComponents}
    >
      {content}
    </ReactMarkdown>
  );
}
