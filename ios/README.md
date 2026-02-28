# iOS MemeGTD

Native iOS app for meme-gtd. Includes a memo timeline, thread detail view, and a Safari Share Extension for saving articles.

## Requirements

- Xcode 16.0+
- iOS 26.0+
- Tailscale (for API connection)

## Project Structure

```
ios/MemeGTD/
├── MemeGTD/
│   ├── Models/             # Data models (Memo, Comment, Label, Project)
│   ├── ViewModels/         # MemoListViewModel, MemoDetailViewModel
│   ├── Views/
│   │   ├── Components/     # Reusable UI (FloatingComposer, ThreadItem, MarkdownBody, etc.)
│   │   ├── RootView.swift  # Root container with slide-out side menu
│   │   ├── MemoListView.swift
│   │   ├── MemoDetailView.swift
│   │   ├── SettingsView.swift
│   │   └── SideMenuView.swift
│   └── Utilities/          # TimelineHelpers, HapticManager, LabelColorHelper
├── ShareExtension/         # Safari Share Extension
└── Shared/                 # Shared code (APIClient, Settings, Colors)
```

## Features

- **Memo timeline**: Chat-like chronological view with date buckets and timestamps
- **Thread detail**: Memo body + comment thread, info modal for labels/projects
- **Side menu**: Claude-style slide-out drawer with rounded content panel
- **Search**: Free text and `label:xxx` prefix search
- **Bookmark filter**: Toggle to show only bookmarked memos
- **Markdown rendering**: Headings, bold, italic, code blocks, links, lists
- **Safari Share Extension**: Save articles directly from Safari

## Build

```bash
cd ios/MemeGTD

# Simulator
xcodebuild -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17' build

# Device
xcodebuild -scheme MemeGTD -destination 'platform=iOS,id=<DEVICE_ID>' build
```

## Install on iPhone

### 1. Connect iPhone to Mac

USB cable required.

### 2. Build in Xcode

1. Open `ios/MemeGTD/MemeGTD.xcodeproj`
2. Select your iPhone from device dropdown
3. Set signing team for both targets:
   - Project Navigator → MemeGTD project → Signing & Capabilities
   - Select your Apple ID for Team
   - **Do this for both MemeGTD and ShareExtension targets**
4. Press Cmd+R to build and run

### 3. Enable Developer Mode

After first build attempt:

1. iPhone: Settings → Privacy & Security → Developer Mode (at bottom) → ON
2. Restart iPhone when prompted

### 4. Trust Developer Certificate

1. iPhone: Settings → General → VPN & Device Management
2. Tap your Apple ID under "Developer App"
3. Tap "Trust"

### 5. Run Again

Build and run from Xcode again. The app should now install and launch.

## Usage

1. Open the app and configure API URL in Settings (gear icon in side menu)
2. Browse memos in the timeline view
3. Tap a memo to view its thread and add comments
4. Use the search bar with `label:book` syntax to filter by labels
5. In Safari, tap Share → "MemeGTD" to save articles

## Deploy (Claude Code)

Not enrolled in Apple Developer Program, so apps signed with a free developer certificate **expire after 7 days**. Periodic rebuild and reinstall is required.

The deploy process is automated via the Claude Code skill (`ios-deploy`).

```
# Just ask Claude Code:
> deploy the ios app
```

What the skill does:
1. Build for Simulator and Device in **parallel**
2. After both builds succeed, install on Simulator and Device in **parallel**
3. Auto-launch the app on Simulator

Prerequisites:
- iPhone connected to Mac via USB
- Xcode signing configured for both targets (first time only)
- Device ID set in `.claude/skills/ios-deploy/SKILL.md`

## Design System

### Liquid Glass (iOS 26)

All floating UI elements use iOS 26 Liquid Glass depth effects. The design is built on two primitives:

#### `PillSurface` (ViewModifier)

The single source of truth for floating element appearance. Apply to any view with `.modifier(PillSurface(radius:))`.

- Uses `.glassEffect(.regular)` — provides backdrop blur, edge highlights, and depth automatically
- No manual background color, border stroke, or shadow needed
- Already applied to: `FloatingComposer`, `BottomBar` pills, info circle button

When adding new floating elements (e.g., Task action buttons, Project cards), use `PillSurface` to maintain visual consistency.

#### `safeAreaBar` + `scrollEdgeEffectStyle` (layout pattern)

Bottom bars are placed inside `.safeAreaBar(edge: .bottom)` instead of `ZStack` overlays. This enables:

- Automatic safe area inset management (no manual spacer height)
- Progressive blur where scrolling content meets the bar (scroll edge effect)
- Proper backdrop blur of underlying content

When creating a new list view (e.g., TaskListView, ProjectListView), follow this pattern:

```swift
ScrollView {
    LazyVStack(spacing: 0) {
        // ... content ...
        Color.clear.frame(height: 1).id("bottom")
    }
}
.scrollEdgeEffectStyle(.soft, for: .bottom)
.safeAreaBar(edge: .bottom) {
    // bottom bar content here
    YourBottomBar()
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
}
```

### Side Menu

Claude-style slide-out drawer with cream background (`#F5F0E8`) and content opacity fade. Implemented in `SideMenuView.swift` and `RootView.swift`.

## Notes

- **7-day rule**: Free developer certificate expires after 7 days. Rebuild and reinstall required
- **Tailscale**: Must be connected on iPhone for API access
- **Share Extension Memory Limit**: 120MB
- **Dark mode**: Not supported (forced light mode)

## Update JavaScript Bundle

When `packages/extension/src/content/extractor.ts` changes:

```bash
cd packages/extension
pnpm exec esbuild src/ios-extractor.ts --bundle --format=iife --outfile=../../ios/MemeGTD/ShareExtension/Resources/extractor.bundle.js --target=es2020
```

## Troubleshooting

### "Untrusted Developer"

Settings → General → VPN & Device Management → Developer App → Trust

### "API URL is not configured"

Open the app → side menu → gear icon → set your API URL.

### "Network error"

- Ensure Tailscale VPN is connected on iPhone
- Verify API server is running
- Check URL is correct (include `http://` prefix)

### Extension not appearing in Share menu

Settings → General → Share Sheet → Find MemeGTD and enable it
