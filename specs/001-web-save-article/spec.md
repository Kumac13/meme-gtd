# Feature Specification: Web Article Saving (Phase 1)

**Feature Branch**: `001-web-save-article`
**Created**: 2025-12-11
**Status**: Draft
**Input**: User description provided in prompt

## User Scenarios & Testing

### User Story 1 - Save Web Article via Extension (Priority: P1)

As a user browsing the web, I want to save the current page to my local database with a single click, so that I can read it later without distractions or ads, even if the original page requires authentication.

**Why this priority**: This is the core data ingestion mechanism. Without this, there is no content to read or manage.

**Independent Test**: Can be tested by installing the browser extension, logging into a site (e.g., a paywalled article), clicking the save button, and verifying the content appears in the local database.

**Acceptance Scenarios**:

1. **Given** I am on a web page with text content (authenticated or public), **When** I click the extension icon, **Then** the extension shows "Saving..." then "Saved!" and the article content is stored in the local database.
2. **Given** the page has ads and navigation, **When** it is saved, **Then** only the main article content is extracted and stored.
3. **Given** I am on a page requiring login, **When** I save it, **Then** the content visible to me is saved (not the login page).

---

### User Story 2 - View Article List (Priority: P1)

As a user, I want to see a list of my saved articles sorted by date, so that I can quickly find what I want to read.

**Why this priority**: Users need a way to access their saved content.

**Independent Test**: Can be tested by navigating to the `/articles` route in the Web UI.

**Acceptance Scenarios**:

1. **Given** I have saved articles, **When** I visit the Articles list, **Then** I see a list showing title, site name, and relative saved time.
2. **Given** I have no articles, **When** I visit the list, **Then** I see an empty state.

---

### User Story 3 - Read Article in Reader View (Priority: P1)

As a user, I want to read a saved article in a clean, distraction-free layout, so that I can focus on the content.

**Why this priority**: The primary consumption value proposition is a clean reading experience.

**Independent Test**: Can be tested by clicking an article in the list and verifying the view mode.

**Acceptance Scenarios**:

1. **Given** I am viewing the article list, **When** I click an article, **Then** I see the full content in a simplified Reader View (serif font, comfortable spacing).
2. **Given** an article has links to original images, **When** viewed, **Then** images are loaded from the original URL (if online).
3. **Given** I am reading, **When** I want to see the source, **Then** there is a link to the original URL.

---

### User Story 4 - Organize and Link Articles (Priority: P2)

As a user, I want to apply labels to articles and link them to tasks/memos, so that I can preserve the context of why I saved them (e.g., for a specific research task).

**Why this priority**: Solves the "why did I save this?" problem which is a key differentiator from Instapaper.

**Independent Test**: Can be tested by opening an article and using the existing Label/Link UI components.

**Acceptance Scenarios**:

1. **Given** an open article, **When** I add a label (e.g., "React"), **Then** the article is categorized under that label.
2. **Given** a task "Research RSC", **When** I link the saved article to it, **Then** the article appears in the task's context/links.

---

### User Story 5 - Highlight Text (Priority: P3 - Phase 2)

As a user, I want to highlight important sections of the text, so that I can quickly reference key points later.

**Why this priority**: Enhances the reading/research value but not strictly required for the MVP (Phase 1).

**Independent Test**: Select text in Reader View and click "Highlight".

**Acceptance Scenarios**:

1. **Given** I am reading an article, **When** I select text and choose highlight, **Then** the text is visually highlighted and persisted.
2. **Given** I reload the article, **When** the page renders, **Then** the highlights are restored at the correct positions.

### Edge Cases

- **Authentication Expiry**: If the user's session on the source site expires while viewing, the saved content remains available (since it's local).
- **Dynamic Content**: Pages that load content via infinite scroll might only capture the currently visible DOM. The user is expected to scroll to load content before saving.
- **Broken Images**: If original images are deleted from the server, the Reader View will show broken image placeholders (as per design choice to not save images locally).

## Requirements

### Functional Requirements

- **FR-001**: System MUST accept article data (HTML/Markdown, Metadata) from a browser extension or external source.
- **FR-002**: System MUST store article content locally on the user's device.
- **FR-003**: System MUST NOT rely on server-side fetching for content; it MUST accept the DOM content provided by the client (extension) to support authenticated pages.
- **FR-004**: System MUST parse and clean web content to extract the main article body (remove ads, nav).
- **FR-005**: System MUST store article metadata including Title, Original URL, Site Name, and Saved Date.
- **FR-006**: System MUST provide a list view of all saved articles.
- **FR-007**: System MUST provide a detail view (Reader View) for individual articles using a readable typography (e.g., serif, wide margins).
- **FR-008**: System MUST integrate with existing Labeling, Commenting, and Linking systems (allow articles to be labeled/linked like tasks).
- **FR-009**: System MUST generate and persist unique IDs for block elements in the saved content to support future highlighting (Phase 2 readiness).
- **FR-010**: System MUST NOT save images locally; it MUST retain original image URLs.

### Key Entities

- **Article**: Represents the saved web content.
  - Attributes: Title, Body (Markdown/HTML), Original URL, Site Name, Saved Date.
- **ArticleHighlight** (Phase 2): Represents a user-selected text range.
  - Attributes: Article ID, Start/End Block IDs, Offsets, Text, Color, Note.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can save a typical news article from a browser to the local database in under 5 seconds (including processing).
- **SC-002**: Saved articles from authenticated sessions (e.g., logged-in news site) display the full content, not the login screen.
- **SC-003**: Reader View successfully renders the main body text for 90% of standard article pages (e.g., blog posts, news sites).
- **SC-004**: Users can navigate from a Task to a linked Article and back with one click.

## Assumptions & Constraints

- **Single Device**: No sync required between devices.
- **Local Storage**: Text is local; images are remote (require internet to view).
- **Browser**: Extension targets Chrome/Chromium-based browsers initially.
- **Phase 1 Scope**: Focus on Saving, Viewing, and Linking. Highlighting is Phase 2.