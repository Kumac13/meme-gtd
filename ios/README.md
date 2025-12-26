# iOS MemeGTD

Safari Share Extension for saving articles to meme-gtd.

## Requirements

- Xcode 15.0+
- iOS 16.0+
- Tailscale (for API connection)

## Project Structure

```
ios/MemeGTD/
├── MemeGTD/          # Host app (settings screen)
├── ShareExtension/   # Safari Share Extension
└── Shared/           # Shared code between targets
```

## Build

```bash
xcodebuild -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17' build
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

### 3. Enable Developer Mode (iOS 16+)

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

1. Open host app and configure API URL (e.g., `http://100.x.x.x:3000`)
2. In Safari, tap Share button
3. Select "MemeGTD" from share sheet
4. Article will be extracted and saved

## Notes

- **Without Apple Developer Program**: App expires after 7 days, rebuild required
- **Tailscale**: Must be connected on iPhone for API access
- **Share Extension Memory Limit**: 120MB

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

Open the main MemeGTD app and set your API URL.

### "Network error"

- Ensure Tailscale VPN is connected on iPhone
- Verify API server is running
- Check URL is correct (include `http://` prefix)

### Extension not appearing in Share menu

Settings → General → Share Sheet → Find MemeGTD and enable it
