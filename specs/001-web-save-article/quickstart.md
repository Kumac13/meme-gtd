# Quickstart: Web Article Saving

## Prerequisites
- Node.js 18+
- Chrome/Chromium Browser

## 1. Setup Extension
1. Go to `packages/extension`.
2. Run `pnpm install`.
3. Run `pnpm build`.
4. Open Chrome -> Extensions -> Load Unpacked -> Select `packages/extension/dist`.

## 2. Start API
1. Run `pnpm start:api` (or equivalent dev command).
2. API should be running at `http://localhost:3000`.

## 3. Save an Article
1. Navigate to a news article (e.g., https://example.com).
2. Click the extension icon.
3. Observe "Saving..." -> "Saved!".

## 4. View Article
1. Open Web UI (`http://localhost:5173`).
2. Go to `/articles`.
3. Click the saved article title.
