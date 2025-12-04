/**
 * Markdown rendering utilities for meme-gtd Web UI
 */

import { useState, useRef, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import type { Components } from 'react-markdown';

/**
 * Recursively extract plain text from React children
 * Used to get code content for clipboard copy
 */
function extractTextFromChildren(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (children == null) return '';
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('');
  }
  if (typeof children === 'object' && 'props' in children) {
    const props = children.props as { children?: ReactNode };
    if (props.children) {
      return extractTextFromChildren(props.children);
    }
  }
  return '';
}

/**
 * Clipboard icon (copy state)
 */
function ClipboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

/**
 * Checkmark icon (copied state)
 */
function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * Code block wrapper with copy button
 * Wraps fenced code blocks with a copy-to-clipboard button
 * Uses DOM ref to extract code text, avoiding inclusion of <details>/<summary> tags
 */
function CodeBlockWithCopy({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = async () => {
    try {
      // Get code text directly from DOM to exclude any wrapper tags like <details>/<summary>
      const codeElement = preRef.current?.querySelector('code');
      const codeText = (codeElement?.textContent ?? extractTextFromChildren(children)).replace(/\n$/, '');
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="relative mb-4">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-gray-700/80 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors z-10"
        title={copied ? 'Copied!' : 'Copy code'}
        type="button"
      >
        {copied ? <CheckIcon /> : <ClipboardIcon />}
      </button>
      <pre ref={preRef} className="bg-gray-900 text-gray-100 py-3 px-4 pr-12 rounded-lg overflow-x-auto text-sm font-mono">
        {children}
      </pre>
    </div>
  );
}

/**
 * Transform attachment absolute paths to API URLs
 * Converts paths like `/Users/xxx/.mgtd/attachments/42/abc123.png`
 * to `/api/attachments/42/abc123.png`
 */
function transformAttachmentPath(src: string | undefined): string | undefined {
  if (!src) return src;

  // Match pattern: any path containing .mgtd/attachments/{issueId}/{filename}
  const attachmentPattern = /\.mgtd\/attachments\/(\d+)\/([a-zA-Z0-9-]+\.(png|jpe?g|gif|webp))$/i;
  const match = src.match(attachmentPattern);

  if (match) {
    const issueId = match[1];
    const filename = match[2];
    return `/api/attachments/${issueId}/${filename}`;
  }

  return src;
}

/**
 * Default markdown components configuration with Tailwind CSS styling
 */
const defaultComponents: Components = {
  // Images with attachment path transformation
  img: ({ src, alt, ...props }) => {
    const transformedSrc = transformAttachmentPath(src);
    return (
      <img
        src={transformedSrc}
        alt={alt || ''}
        className="max-w-full h-auto rounded-lg my-4"
        loading="lazy"
        {...props}
      />
    );
  },

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

  // Code blocks (inline only - fenced code blocks are handled by pre component)
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      );
    }
    // Fenced code block - styles are applied by parent pre/CodeBlockWithCopy
    return (
      <code className="text-gray-100 text-sm font-mono">
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

  // Pre element wrapper for fenced code blocks with copy button
  pre: ({ children }) => <CodeBlockWithCopy>{children}</CodeBlockWithCopy>,
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
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
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
    // Images with attachment path transformation
    img: ({ src, alt, ...props }) => {
      const transformedSrc = transformAttachmentPath(src);
      return (
        <img
          src={transformedSrc}
          alt={alt || ''}
          className="max-w-full h-auto rounded inline-block max-h-16"
          loading="lazy"
          {...props}
        />
      );
    },
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
