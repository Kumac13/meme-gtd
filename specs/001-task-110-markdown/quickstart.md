# Quickstart: Markdown Code Block Copy Button

## Overview

This feature adds a copy button to fenced code blocks in markdown content. When users view tasks, memos, or comments containing code blocks (```), they can click a button to copy the code to their clipboard with one click.

## Files to Modify/Create

### 1. Modify: `packages/web/src/utils/markdown.tsx`

Add a `pre` component override and a helper function:

```tsx
// Add after imports
function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('');
  }
  if (React.isValidElement(children) && children.props?.children) {
    return extractTextFromChildren(children.props.children);
  }
  return '';
}

// Add CodeBlockWithCopy component
function CodeBlockWithCopy({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = extractTextFromChildren(children);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
        title={copied ? 'Copied!' : 'Copy code'}
      >
        {copied ? <CheckIcon /> : <ClipboardIcon />}
      </button>
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4 pt-10">
        {children}
      </pre>
    </div>
  );
}

// Add to defaultComponents
pre: ({ children }) => <CodeBlockWithCopy>{children}</CodeBlockWithCopy>,
```

### 2. Test File: `packages/web/tests/unit/markdown-copy.test.tsx`

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkdownRenderer } from '../../src/utils/markdown';

describe('Code Block Copy Button', () => {
  it('renders copy button for fenced code blocks', () => {
    render(<MarkdownRenderer content="```js\nconsole.log('hello');\n```" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('copies code content when button is clicked', async () => {
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(<MarkdownRenderer content="```\ntest code\n```" />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockClipboard.writeText).toHaveBeenCalledWith('test code\n');
  });

  it('does not render copy button for inline code', () => {
    render(<MarkdownRenderer content="This is `inline` code" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
```

## Development Steps

1. **Read existing markdown.tsx** to understand current structure
2. **Write tests first** (TDD approach per constitution)
3. **Implement CodeBlockWithCopy** component
4. **Add pre component override** to defaultComponents
5. **Test manually** in development server (`pnpm dev:web`)
6. **Run Vitest** to verify unit tests pass
7. **Run E2E tests** with Playwright if applicable

## Verification Checklist

- [ ] Copy button visible on all fenced code blocks
- [ ] Button positioned in top-right corner
- [ ] Clicking copies exact code content (no fence markers)
- [ ] Visual feedback shown after copy (checkmark icon)
- [ ] Feedback resets after ~1.5 seconds
- [ ] No button on inline code
- [ ] Works in task body, memo body, and comments
