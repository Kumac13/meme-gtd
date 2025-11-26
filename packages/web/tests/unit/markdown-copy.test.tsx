import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarkdownRenderer } from '../../src/utils/markdown';

describe('Code Block Copy Button', () => {
  let originalClipboard: Clipboard;

  beforeEach(() => {
    // Save original clipboard
    originalClipboard = navigator.clipboard;

    // Mock clipboard API
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  // T003: Copy button renders for fenced code blocks
  it('renders copy button for fenced code blocks', () => {
    render(<MarkdownRenderer content={'```js\nconsole.log("hello");\n```'} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Copy code');
  });

  // T004: Copy button copies correct content
  it('copies code content when button is clicked', async () => {
    const codeContent = 'console.log("hello");';
    render(<MarkdownRenderer content={`\`\`\`js\n${codeContent}\n\`\`\``} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining(codeContent));
    });
  });

  // T005: No copy button for inline code
  it('does not render copy button for inline code', () => {
    render(<MarkdownRenderer content="This is `inline` code" />);

    const button = screen.queryByRole('button');
    expect(button).not.toBeInTheDocument();
  });

  // T010: Copy button has correct positioning and accessibility
  it('has correct tooltip and accessibility attributes', () => {
    render(<MarkdownRenderer content={'```\ncode\n```'} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Copy code');
    expect(button).toHaveAttribute('type', 'button');
  });

  // Additional test: Visual feedback after copy
  it('shows visual feedback after successful copy', async () => {
    render(<MarkdownRenderer content={'```\ncode\n```'} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Copy code');

    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toHaveAttribute('title', 'Copied!');
    });
  });

  // Edge case: Multiple code blocks work independently
  it('renders multiple copy buttons for multiple code blocks', () => {
    render(
      <MarkdownRenderer
        content={'```\nblock1\n```\n\n```\nblock2\n```'}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  // Edge case: Empty code block
  it('handles empty code blocks gracefully', async () => {
    render(<MarkdownRenderer content={'```\n```'} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });
});
