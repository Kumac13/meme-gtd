# Research: Markdown Code Block Copy Button

**Date**: 2025-11-26
**Feature**: 001-task-110-markdown

## Research Questions

### 1. How to add a copy button to react-markdown code blocks?

**Decision**: Override the `pre` component in react-markdown's components prop to wrap code blocks with a container that includes a copy button.

**Rationale**:
- react-markdown renders fenced code blocks as `<pre><code>...</code></pre>`
- The `pre` component receives children (the `<code>` element) and can wrap them with additional UI
- The code content can be extracted from the children's text content
- This approach is non-invasive and doesn't require modifying the markdown parsing

**Alternatives Considered**:
1. Override `code` component only - Rejected: Can't add wrapper around `<pre>` from inside `<code>`
2. Use a rehype plugin - Rejected: More complex, requires AST manipulation
3. Post-process rendered HTML - Rejected: Breaks React's virtual DOM, potential XSS concerns

**Implementation Approach**:
```tsx
// In markdown.tsx defaultComponents
pre: ({ children, ...props }) => {
  // children is the <code> element
  // Extract text content for copying
  return (
    <div className="relative group">
      <CopyButton content={extractTextFromChildren(children)} />
      <pre {...props}>{children}</pre>
    </div>
  );
}
```

### 2. How to extract text content from React children for copying?

**Decision**: Use a utility function to recursively extract text from React children.

**Rationale**:
- react-markdown passes the code content as nested React elements/strings
- Need to flatten the children tree to get plain text for clipboard
- Similar pattern used in other markdown-copy implementations

**Implementation**:
```tsx
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
```

### 3. Existing clipboard hook compatibility

**Decision**: Reuse the existing `useCopyToClipboard` hook from `packages/web/src/hooks/useCopyToClipboard.ts`.

**Rationale**:
- Already implements navigator.clipboard.writeText
- Provides `copied` state for visual feedback
- Auto-resets after 1 second (matches spec requirement of 1-2 seconds)
- Error handling already in place

**Note**: The hook uses `useCallback` and `useState`, making it suitable for use within the copy button component.

### 4. Copy button styling approach

**Decision**: Use Tailwind CSS classes consistent with existing codebase styling, following GitHub's design pattern.

**Rationale**:
- Project already uses Tailwind CSS 4.1.14
- GitHub-inspired design mentioned in spec assumptions
- Dark background for code blocks already exists (`bg-gray-900`)

**Style Specifications**:
- Button position: `absolute top-2 right-2`
- Button appearance: Semi-transparent background, rounded corners
- Icon: Clipboard icon (default) → Checkmark (copied state)
- Hover state: Slightly more opaque

### 5. Icon implementation

**Decision**: Use inline SVG icons for clipboard and checkmark, no external dependency.

**Rationale**:
- Project doesn't have a dedicated icon library
- SVG icons are small and can be inlined
- Avoids adding new dependencies for 2 simple icons

**Icons**:
```tsx
// Clipboard icon (copy state)
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
</svg>

// Checkmark icon (copied state)
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
</svg>
```

### 6. Distinguishing fenced vs inline code blocks

**Decision**: Detect fenced code blocks by checking if the `code` component has a `className` prop (language identifier from fence syntax).

**Rationale**:
- react-markdown passes `className` like `language-javascript` for fenced blocks
- Inline code (`backticks`) has no `className`
- This is the existing pattern in `markdown.tsx` line 58: `const isInline = !className`

**Implementation**: The `pre` component only exists for fenced code blocks, so no additional check needed in the `pre` override.

## Resolved Clarifications

All technical unknowns from the Technical Context have been resolved. No NEEDS CLARIFICATION items remain.

## References

- [react-markdown components prop](https://github.com/remarkjs/react-markdown#components)
- Existing implementation: `packages/web/src/utils/markdown.tsx`
- Existing hook: `packages/web/src/hooks/useCopyToClipboard.ts`
