# Tasks: PWA化 - WebUIのProgressive Web App対応

**Input**: Design documents from `/specs/001-pwa-webui-progressive/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: テスト要件は明示されていないため、手動検証（Lighthouse PWA監査）のみ。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo web app**: `packages/web/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: vite-plugin-pwa依存パッケージのインストール

- [x] T001 [Setup] Install vite-plugin-pwa: `pnpm --filter meme-gtd-web add -D vite-plugin-pwa`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: PWAアイコンの作成 - すべてのUser Storyで必要

**⚠️ CRITICAL**: アイコンがないとmanifestが不完全になり、PWAとして認識されない

- [x] T002 [P] [Foundation] Create pwa-192x192.png: 192x192 PNG, 青背景(#3b82f6)に白文字「M」, save to `packages/web/public/pwa-192x192.png`
- [x] T003 [P] [Foundation] Create pwa-512x512.png: 512x512 PNG, 青背景(#3b82f6)に白文字「M」, save to `packages/web/public/pwa-512x512.png`
- [x] T004 [P] [Foundation] Create apple-touch-icon-180x180.png: 180x180 PNG, 青背景(#3b82f6)に白文字「M」, save to `packages/web/public/apple-touch-icon-180x180.png`
- [x] T005 [P] [Foundation] Create favicon.svg: SVG format, 青背景に白「M」, save to `packages/web/public/favicon.svg`

**Checkpoint**: Icons ready - User Story implementation can now begin

---

## Phase 3: User Story 1 - ホーム画面へのアプリ追加 (Priority: P1) 🎯 MVP

**Goal**: ユーザーがホーム画面にアプリを追加し、スタンドアロンモードで起動できる

**Independent Test**:
- iOSまたはAndroidデバイスで「ホーム画面に追加」を実行
- ホーム画面からアプリを起動し、ブラウザUIなしで表示されることを確認
- Lighthouse PWA監査で「インストール可能」が緑色

### Implementation for User Story 1

- [ ] T006 [US1] Update vite.config.ts: Add VitePWA plugin with manifest configuration in `packages/web/vite.config.ts`
  - Import `VitePWA` from 'vite-plugin-pwa'
  - Add to plugins array with:
    - `registerType: 'autoUpdate'`
    - manifest: name, short_name, theme_color (#3b82f6), background_color (#ffffff), display: 'standalone'
    - icons: pwa-192x192.png, pwa-512x512.png

- [ ] T007 [US1] Update index.html: Add PWA meta tags in `packages/web/index.html`
  - `<meta name="theme-color" content="#3b82f6">`
  - `<meta name="apple-mobile-web-app-capable" content="yes">`
  - `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
  - `<meta name="apple-mobile-web-app-title" content="meme-gtd">`
  - `<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png">`
  - Update favicon link to use `/favicon.svg`

- [ ] T008 [US1] Build and verify: Run `pnpm build` in packages/web, confirm `dist/` contains:
  - `sw.js` (Service Worker)
  - `manifest.webmanifest`

**Checkpoint**: User Story 1 complete - App can be installed to home screen and launches in standalone mode

---

## Phase 4: User Story 2 - オフライン時の基本アクセス (Priority: P2)

**Goal**: 一度アクセスしたユーザーがオフライン時にアプリUIを表示できる

**Independent Test**:
- アプリを一度読み込む
- 機内モード（オフライン）にする
- アプリを再起動し、UIが表示されることを確認

### Implementation for User Story 2

- [ ] T009 [US2] Configure Workbox caching in vite.config.ts: Add workbox options to VitePWA config in `packages/web/vite.config.ts`
  - `globPatterns: ['**/*.{js,css,html,ico,png,svg}']`
  - `cleanupOutdatedCaches: true`

- [ ] T010 [US2] Verify offline functionality:
  - Build the app (`pnpm build`)
  - Preview (`pnpm preview`)
  - Load app in browser
  - Open DevTools → Application → Service Workers → check "Offline"
  - Reload page - UI should still render

**Checkpoint**: User Story 2 complete - Offline static asset access works

---

## Phase 5: User Story 3 - スプラッシュ画面の表示 (Priority: P3)

**Goal**: ホーム画面からアプリ起動時にスプラッシュ画面が表示される

**Independent Test**:
- ホーム画面からアプリを起動
- 起動時にスプラッシュ画面（アイコン + テーマカラー背景）が表示されることを確認

### Implementation for User Story 3

- [ ] T011 [US3] Verify manifest splash screen config in vite.config.ts: Ensure manifest includes:
  - `background_color: '#ffffff'` (スプラッシュ画面背景)
  - 512x512 icon (スプラッシュ画面で使用)
  - `name` (スプラッシュ画面に表示)

- [ ] T012 [US3] Test splash screen on mobile device:
  - Install app to home screen (iOS/Android)
  - Force close the app
  - Launch from home screen
  - Verify splash screen appears during load

**Checkpoint**: User Story 3 complete - Splash screen displays on app launch

---

## Phase 6: Polish & Validation

**Purpose**: 最終検証と品質確認

- [ ] T013 [Polish] Run Lighthouse PWA audit:
  - Build and preview app
  - Open Chrome DevTools → Lighthouse → check "Progressive Web App"
  - Run audit and confirm "Installable" badge is green
  - Document any warnings

- [ ] T014 [Polish] Test on iOS 26 device:
  - Access app in Safari
  - Use "Add to Home Screen"
  - Verify standalone mode launch
  - Verify theme color in status bar
  - Test offline mode

- [ ] T015 [Polish] Test on Android Chrome:
  - Access app in Chrome
  - Use "Add to Home Screen" or install prompt
  - Verify standalone mode launch
  - Test offline mode

- [ ] T016 [Polish] Update package.json version and CHANGELOG if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (icons must exist)
- **User Story 2 (Phase 4)**: Can run in parallel with US1 after Foundational
- **User Story 3 (Phase 5)**: Depends on US1 (manifest must be configured)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Requires icons from Foundational phase
- **User Story 2 (P2)**: Technically independent, but typically configured alongside US1
- **User Story 3 (P3)**: Relies on manifest configuration from US1

### Within Each User Story

- Config changes (vite.config.ts) before HTML changes
- Build verification after config changes

### Parallel Opportunities

**Phase 2 (Foundational)**:
```bash
# All icon creation tasks can run in parallel:
T002: Create pwa-192x192.png
T003: Create pwa-512x512.png
T004: Create apple-touch-icon-180x180.png
T005: Create favicon.svg
```

**Phase 6 (Polish)**:
```bash
# Device testing can run in parallel:
T014: Test on iOS 26 device
T015: Test on Android Chrome
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T005)
3. Complete Phase 3: User Story 1 (T006-T008)
4. **STOP and VALIDATE**: Run Lighthouse PWA audit
5. App is installable to home screen

### Incremental Delivery

1. Setup + Foundational → Icons ready
2. Add User Story 1 → App installable (MVP!)
3. Add User Story 2 → Offline support enabled
4. Add User Story 3 → Splash screen works
5. Polish → Full validation complete

### Quick Implementation Path

Since US2 config is typically added alongside US1:
1. T001 → T002-T005 (parallel) → T006 + T009 (combine in same edit) → T007 → T008-T010 → T011-T015

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story can be tested independently after completion
- Lighthouse PWA audit is the primary validation tool
- iOS 26 automatically enables "Open as Web App" - proper manifest ensures good experience
- No custom Service Worker code needed - vite-plugin-pwa handles everything
