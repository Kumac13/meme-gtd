/**
 * Markdown rendering utilities for meme-gtd Web UI
 */

import { Children, isValidElement, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import type { IssueType } from 'meme-gtd-shared';
import ReactMarkdown from 'react-markdown';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import type { Components } from 'react-markdown';
import type { Element } from 'hast';
import { InteractiveTodoItem, todoIndexFromSortableId, todoSortableId } from '../components/InteractiveTodoItem';
import { enumerateTodos, type MoveTodoResult } from './todoMarkdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import jsLang from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import tsLang from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import jsxLang from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsxLang from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import sqlLang from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import mdLang from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import bashLang from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import jsonLang from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import pythonLang from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import cssLang from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import { MermaidDiagram } from '../components/MermaidDiagram';
import { remarkFlattenListParagraphs } from './remarkFlattenListParagraphs';

// Register languages for light Prism build (order matters for dependencies)
SyntaxHighlighter.registerLanguage('javascript', jsLang);
SyntaxHighlighter.registerLanguage('typescript', tsLang);
SyntaxHighlighter.registerLanguage('jsx', jsxLang);
SyntaxHighlighter.registerLanguage('tsx', tsxLang);
SyntaxHighlighter.registerLanguage('sql', sqlLang);
SyntaxHighlighter.registerLanguage('markdown', mdLang);
SyntaxHighlighter.registerLanguage('bash', bashLang);
SyntaxHighlighter.registerLanguage('json', jsonLang);
SyntaxHighlighter.registerLanguage('python', pythonLang);
SyntaxHighlighter.registerLanguage('css', cssLang);

// Map fenced code block language aliases to registered names
const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  sql: 'sql',
  md: 'markdown',
  markdown: 'markdown',
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  json: 'json',
  python: 'python',
  py: 'python',
  css: 'css',
};

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
 * Syntax highlighted code block with copy button
 * Used when the fenced code block has a recognized language identifier
 */
function SyntaxHighlightedBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.replace(/\n$/, ''));
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
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.875rem', paddingRight: '3rem' }}
      >
        {code.replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
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
 * Converts `/Users/xxx/.mgtd/attachments/abc123.png` to `/api/attachments/abc123.png`
 */
function transformAttachmentPath(src: string | undefined): string | undefined {
  if (!src) return src;

  // Match pattern: .mgtd/attachments/{filename}
  const attachmentPattern = /\.mgtd\/attachments\/([a-zA-Z0-9-]+\.(png|jpe?g|gif|webp))$/i;
  const match = src.match(attachmentPattern);

  if (match) {
    const filename = match[1];
    return `/api/attachments/${filename}`;
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
  p: ({ children }) => <p className="mb-2 text-gray-700 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-700">{children}</em>,

  // Lists
  ul: ({ children, className }) => {
    const isTaskList =
      typeof className === 'string' && className.split(' ').includes('contains-task-list');
    if (isTaskList) {
      // Task lists: flush to content edge so the row itself can be the drag handle
      return <ul className="list-none pl-0 mb-4 space-y-1 text-gray-700">{children}</ul>;
    }
    // list-outside + padding: 折り返し行やネストしたリストがマーカー位置に食い込まない（GitHub同等）
    return <ul className="list-disc list-outside pl-6 mb-4 space-y-1 text-gray-700">{children}</ul>;
  },
  ol: ({ children }) => <ol className="list-decimal list-outside pl-6 mb-4 space-y-1 text-gray-700">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,

  // Links
  a: ({ href, children }) => {
    if (href && /^\/(memos|tasks|articles)\/\d+/.test(href)) {
      return (
        <RouterLink
          to={href}
          className="text-github-green-600 hover:text-github-green-800 underline break-words"
        >
          {children}
        </RouterLink>
      );
    }
    return (
      <a
        href={href}
        className="text-github-green-600 hover:text-github-green-800 underline break-words"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },

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

  // Pre element wrapper for fenced code blocks with copy button, Mermaid support, and syntax highlighting
  pre: ({ children, node }) => {
    const codeChild = node?.children?.[0] as Element | undefined;
    if (codeChild?.type === 'element' && codeChild?.tagName === 'code') {
      const className = codeChild.properties?.className;
      const classNames = Array.isArray(className) ? className : [];

      // Check for Mermaid diagram
      if (classNames.some((c) => c === 'language-mermaid')) {
        const textNode = codeChild.children?.[0];
        if (textNode?.type === 'text') {
          return <MermaidDiagram chart={textNode.value} />;
        }
      }

      // Check for syntax highlighting
      const langClass = classNames.find((c) => typeof c === 'string' && c.startsWith('language-'));
      if (langClass) {
        const langKey = (langClass as string).replace('language-', '');
        const canonicalLang = LANGUAGE_MAP[langKey];
        if (canonicalLang) {
          const textNode = codeChild.children?.[0];
          const code = textNode?.type === 'text' ? textNode.value : '';
          return <SyntaxHighlightedBlock language={canonicalLang} code={code} />;
        }
      }
    }
    return <CodeBlockWithCopy>{children}</CodeBlockWithCopy>;
  },
};

const ISSUE_LINK_RE = /^\/(memos|tasks|articles)\/(\d+)(?:\/|$|\?|#)/;

const slugToIssueType: Record<string, IssueType> = {
  memos: 'memo',
  tasks: 'task',
  articles: 'article',
};

interface IssueAnchorProps {
  href?: string;
  children?: ReactNode;
}

/**
 * Build an `a` component that delegates internal `#id` links to a click
 * handler (used by ItemDetail page mode to open the target in a modal,
 * matching the LinkSection behavior). External URLs still open in a new tab.
 */
function makeIssueAwareAnchor(
  onIssueLinkClick: (id: number, type: IssueType) => void,
): (props: IssueAnchorProps) => ReactNode {
  return ({ href, children }) => {
    if (href) {
      const match = ISSUE_LINK_RE.exec(href);
      if (match) {
        const type = slugToIssueType[match[1]];
        const id = parseInt(match[2], 10);
        if (type && Number.isFinite(id)) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onIssueLinkClick(id, type);
              }}
              className="text-github-green-600 hover:text-github-green-800 underline break-words bg-transparent border-0 p-0 cursor-pointer"
            >
              {children}
            </button>
          );
        }
      }
    }
    if (href && /^\/(memos|tasks|articles)\/\d+/.test(href)) {
      return (
        <RouterLink
          to={href}
          className="text-github-green-600 hover:text-github-green-800 underline break-words"
        >
          {children}
        </RouterLink>
      );
    }
    return (
      <a
        href={href}
        className="text-github-green-600 hover:text-github-green-800 underline break-words"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  };
}

interface InteractiveTodosOptions {
  enabled: boolean;
  onToggle: (idx: number, nextChecked: boolean) => void;
  onReorder?: (from: number, to: number) => MoveTodoResult['reason'] | null;
}

interface MarkdownRendererProps {
  content: string;
  components?: Components;
  className?: string;
  interactiveTodos?: InteractiveTodosOptions;
  /**
   * When supplied, internal issue links (`/memos/:id` etc.) render as a
   * button that calls this handler instead of navigating. Mirrors
   * LinkSection's open-in-modal behavior.
   */
  onIssueLinkClick?: (id: number, type: IssueType) => void;
}

function hasTaskListClass(className: unknown): boolean {
  if (typeof className !== 'string') return false;
  return className.split(' ').includes('task-list-item');
}

function readCheckedFromChildren(children: ReactNode): boolean {
  for (const child of Children.toArray(children)) {
    if (isValidElement(child) && child.type === 'input') {
      const props = child.props as { checked?: boolean };
      return Boolean(props.checked);
    }
  }
  return false;
}

export function MarkdownRenderer({
  content,
  components,
  className = '',
  interactiveTodos,
  onIssueLinkClick,
}: MarkdownRendererProps) {
  const counterRef = useRef(0);
  counterRef.current = 0;
  const [reorderNotice, setReorderNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortable = Boolean(interactiveTodos?.enabled && interactiveTodos.onReorder);

  const todoIds = useMemo(() => {
    if (!sortable) return [] as string[];
    return enumerateTodos(content).map((t) => todoSortableId(t.todoIndex));
  }, [content, sortable]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const showNotice = useCallback((msg: string) => {
    setReorderNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setReorderNotice(null), 2500);
  }, []);

  const onReorderRef = useRef(interactiveTodos?.onReorder);
  onReorderRef.current = interactiveTodos?.onReorder;

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      const from = todoIndexFromSortableId(active.id);
      const to = todoIndexFromSortableId(over.id);
      if (from === null || to === null || from === to) return;
      const reason = onReorderRef.current?.(from, to);
      if (reason === 'cross-parent') {
        showNotice('Cannot move across nesting boundaries.');
      }
    },
    [showNotice],
  );

  const mergedComponents = useMemo<Components>(() => {
    const result: Components = { ...defaultComponents };
    if (onIssueLinkClick) {
      result.a = makeIssueAwareAnchor(onIssueLinkClick);
    }
    if (interactiveTodos?.enabled) {
      const onToggle = interactiveTodos.onToggle;
      result.li = ({ children, className: liClass }) => {
        if (hasTaskListClass(liClass)) {
          const idx = counterRef.current++;
          const checked = readCheckedFromChildren(children);
          return (
            <InteractiveTodoItem
              todoIndex={idx}
              checked={checked}
              onToggle={onToggle}
              sortable={sortable}
            >
              {children}
            </InteractiveTodoItem>
          );
        }
        return <li>{children}</li>;
      };
    }
    if (components) Object.assign(result, components);
    return result;
  }, [interactiveTodos?.enabled, interactiveTodos?.onToggle, sortable, onIssueLinkClick, components]);

  const body = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks, remarkFlattenListParagraphs]}
      rehypePlugins={[rehypeRaw, rehypeSanitize]}
      components={mergedComponents}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className={`markdown-content ${className}`}>
      {reorderNotice && (
        <div className="mb-2 px-3 py-1.5 text-xs bg-amber-100 text-amber-800 border border-amber-300 rounded">
          {reorderNotice}
        </div>
      )}
      {sortable ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={todoIds} strategy={verticalListSortingStrategy}>
            {body}
          </SortableContext>
        </DndContext>
      ) : (
        body
      )}
    </div>
  );
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
 * Extract a multi-line preview from markdown content
 * 改行を保持したまま先頭からmaxLength文字を切り出す（引用や複数段落がブロック構造のままパースされる）
 * @param markdown Markdown content
 * @param maxLength Maximum length for truncation
 * @returns Truncated markdown preserving line structure
 */
export function extractPreview(markdown: string, maxLength: number): string {
  const trimmed = markdown.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.slice(0, maxLength).trimEnd() + '...';
}

/**
 * Inline markdown renderer for list/card previews
 * Renders markdown inline without block-level margins
 * @param props Component props with content string
 * @returns JSX element with inline-rendered markdown
 */
export function InlineMarkdownRenderer({
  content,
  onIssueLinkClick,
}: {
  content: string;
  onIssueLinkClick?: (id: number, type: IssueType) => void;
}) {
  const issueAnchor = onIssueLinkClick ? makeIssueAwareAnchor(onIssueLinkClick) : undefined;
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
    p: ({ children }) => <span className="block text-gray-900">{children}</span>,
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
    a: (props) => {
      if (issueAnchor) {
        const node = issueAnchor(props);
        if (node) return node;
      }
      const { href, children } = props;
      if (href && /^\/(memos|tasks|articles)\/\d+/.test(href)) {
        return (
          <RouterLink
            to={href}
            className="text-github-green-600 hover:text-github-green-800 underline"
          >
            {children}
          </RouterLink>
        );
      }
      return (
        <a
          href={href}
          className="text-github-green-600 hover:text-github-green-800 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
    ul: ({ children }) => <span>{children}</span>,
    ol: ({ children }) => <span>{children}</span>,
    li: ({ children }) => <span className="mr-2">{children}</span>,
    blockquote: ({ children }) => (
      <span className="block border-l-2 border-gray-300 pl-2 text-gray-600">{children}</span>
    ),
    // Show placeholder for code blocks (including Mermaid diagrams)
    pre: () => <span className="text-gray-500 text-xs">[code]</span>,
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
