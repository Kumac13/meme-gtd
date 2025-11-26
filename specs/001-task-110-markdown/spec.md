# Feature Specification: Markdown Code Block Copy Button

**Feature Branch**: `001-task-110-markdown`
**Created**: 2025-11-26
**Status**: Draft
**Input**: User description: "Task #110: markdownで囲んだ領域を簡単にコピべしたい - \`\`\`で囲んだ領域について、GitHubなどと同様にコピーのアイコンを出して、ワンクリックでコピペできるようにしたい"

## Clarifications

### Session 2025-11-26

- Q: コピーボタンの表示方法（ホバー時 vs 常に表示）？ → A: 常に表示（GitHubと同様）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Copy Code Block with One Click (Priority: P1)

When viewing a task or memo that contains markdown code blocks (fenced with triple backticks), users want to quickly copy the code content to their clipboard without manually selecting the text. This is especially useful for copying commands, code snippets, or configuration examples.

**Why this priority**: This is the core feature request. Code blocks are commonly used for commands and code snippets that users need to copy-paste into terminals or editors. Manual text selection is error-prone and time-consuming.

**Independent Test**: Can be fully tested by creating a task/memo with a code block and clicking the always-visible copy icon. Delivers immediate value by enabling one-click copying.

**Acceptance Scenarios**:

1. **Given** a task or memo body contains a fenced code block (```), **When** the content is rendered, **Then** a copy icon is always visible in the top-right corner of the code block
2. **Given** the copy icon is visible, **When** the user clicks the copy icon, **Then** the code block content (without the fence markers) is copied to the clipboard
3. **Given** the user has clicked the copy icon, **When** the copy operation succeeds, **Then** visual feedback is displayed (e.g., checkmark icon or "Copied!" tooltip) for approximately 1-2 seconds
4. **Given** a task or memo comment contains a fenced code block, **When** the content is rendered, **Then** the copy icon is always visible and the same copy behavior applies as in task/memo body

---

### User Story 2 - Visual Distinction of Copy Button (Priority: P2)

Users need to clearly identify the copy button and understand its purpose without confusion with other UI elements.

**Why this priority**: Without clear visual distinction, users may not discover the feature or may accidentally trigger other actions.

**Independent Test**: Can be tested by observing the copy icon placement and style on various code blocks, confirming it's recognizable and doesn't overlap with code content.

**Acceptance Scenarios**:

1. **Given** a code block is displayed, **When** the content is rendered, **Then** the copy icon is always visible in the top-right corner, does not overlap with code content, and uses a recognizable copy/clipboard icon
2. **Given** the copy icon is displayed, **When** the user hovers over the icon, **Then** a tooltip or visual hint indicates its purpose (e.g., "Copy code" or cursor change)

---

### Edge Cases

- What happens when the code block is empty? → Copy button still appears; clicking it copies an empty string
- What happens when there are multiple code blocks in one body/comment? → Each code block has its own independent copy button
- What happens when the clipboard API is not available (e.g., insecure context)? → Button is hidden or disabled with graceful degradation
- What happens with very long code blocks that require scrolling? → Copy button remains visible in a fixed position relative to the code block header area
- What happens with inline code (single backticks)? → No copy button; only fenced code blocks get the copy functionality

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a copy icon/button on all fenced code blocks (```) in task body, memo body, and comment content
- **FR-002**: System MUST copy the exact code content (excluding fence markers and language identifier) to the clipboard when the copy button is clicked
- **FR-003**: System MUST provide visual feedback (icon change or tooltip) upon successful copy operation
- **FR-004**: System MUST always display the copy button in a consistent location (top-right corner) that does not obstruct the code content (not hover-triggered)
- **FR-005**: System MUST apply the copy button behavior consistently across all markdown rendering contexts (task detail, memo detail, comments)
- **FR-006**: System MUST NOT display a copy button for inline code (single backticks)
- **FR-007**: System MUST handle clipboard API unavailability gracefully (e.g., hide button or show error)

### Key Entities

- **CodeBlock**: A fenced code block within markdown content, containing raw code text and optional language identifier
- **CopyButton**: UI element overlaid on CodeBlock, triggers clipboard copy operation, displays feedback state

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can copy code block content with a single click (vs. 3+ actions for manual selection)
- **SC-002**: Copy operation completes within 0.5 seconds with visible feedback
- **SC-003**: Copy button is discoverable without instructions (users find and use it naturally on first encounter)
- **SC-004**: Feature works consistently across all locations where markdown code blocks are rendered (task body, memo body, comments)

## Assumptions

- Users are on modern browsers that support the Clipboard API (navigator.clipboard.writeText)
- The existing copy hook can be reused for the copy operation
- The copy button will follow the existing application's visual design language (GitHub-inspired styling)
- Fenced code blocks are detected by the presence of a language class in the markdown parser's code component
