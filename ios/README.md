# Meme GTD iOS

Safari Share Extension for saving articles to Meme GTD.

## Setup

### Prerequisites

- Xcode 15.0+
- iOS 16.0+
- Apple Developer Account (free account works for development)

### Create Xcode Project

1. Open Xcode
2. File > New > Project
3. Select "App" under iOS
4. Configure:
   - Product Name: `MemeGTD`
   - Team: Your Apple ID
   - Organization Identifier: `com.memegtd` (or your own)
   - Interface: SwiftUI
   - Language: Swift
5. Save to `ios/MemeGTD/` (replace existing files if prompted)

### Add Share Extension Target

1. File > New > Target
2. Select "Share Extension" under iOS
3. Configure:
   - Product Name: `ShareExtension`
   - Activate scheme when prompted
4. Delete the auto-generated files (ShareViewController.swift, MainInterface.storyboard)

### Configure App Group

1. Select MemeGTD project in navigator
2. Select MemeGTD target > Signing & Capabilities
3. Click "+ Capability" > Add "App Groups"
4. Add group: `group.com.memegtd.app`
5. Repeat for ShareExtension target

### Add Source Files

1. Drag the following folders into the project:
   - `Shared/` folder (add to both MemeGTD and ShareExtension targets)
   - `MemeGTD/` Swift files (MemeGTD target only)
   - `ShareExtension/` Swift files (ShareExtension target only)
   - `ShareExtension/Resources/extractor.bundle.js` (ShareExtension target only)

2. For `extractor.bundle.js`:
   - Ensure "Copy items if needed" is checked
   - Target Membership: ShareExtension only

### Update Info.plist

Replace the auto-generated Info.plist files with the provided ones:
- `MemeGTD/Info.plist` for the main app
- `ShareExtension/Info.plist` for the extension

### Build and Run

1. Select your iPhone or Simulator
2. Build and Run (Cmd+R)
3. Open the app and configure API URL
4. In Safari, share a page and select "Meme GTD"

## Project Structure

```
ios/MemeGTD/
├── MemeGTD/              # Main app
│   ├── MemeGTDApp.swift
│   ├── ContentView.swift
│   └── Info.plist
├── ShareExtension/       # Share Extension
│   ├── ShareViewController.swift
│   ├── Info.plist
│   └── Resources/
│       └── extractor.bundle.js
└── Shared/               # Shared code
    ├── Colors.swift
    ├── Settings.swift
    ├── ArticleModels.swift
    └── APIClient.swift
```

## Regenerate JavaScript Bundle

If the extractor logic changes:

```bash
cd packages/extension
pnpm exec esbuild src/ios-extractor.ts --bundle --format=iife --outfile=../../ios/MemeGTD/ShareExtension/Resources/extractor.bundle.js --target=es2020
```

## Troubleshooting

### "API URL is not configured"
Open the main Meme GTD app and set your API URL (e.g., your Tailscale IP).

### "Network error"
- Ensure Tailscale VPN is connected on your iPhone
- Verify the API server is running
- Check the URL is correct (include `http://` prefix)

### Extension not appearing in Share menu
- Go to Settings > General > Share Sheet
- Find Meme GTD and enable it
