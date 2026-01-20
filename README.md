# Photo Selector

AI-powered photo selection tool that helps you quickly cull through hundreds of photos and find the best ones.

**Perfect for family vacations and events.** Import your RAW or HEIC photos straight from your camera, let AI score and group them, then export your favorites as optimized JPGs ready to share.

**Your photos stay on your computer.** This is a local desktop app - photos are never uploaded to any server. Only small thumbnail images are sent to Claude's API during analysis, and your originals remain safely on your machine.

> **Requires a Claude API key.** You'll need an [Anthropic developer account](https://console.anthropic.com/) to use the AI scoring features. Analysis costs approximately $0.01-0.02 per photo.

![Photo Selector - AI-powered photo selection](screenshots/photo-grid.png)

## Features

- **Smart Photo Analysis**: Claude AI scores and comments on each photo based on composition, lighting, focus, and emotional impact
- **Similarity Grouping**: Automatically groups similar photos (burst shots, duplicates) and shows only the best from each group
- **Score Filtering**: Filter photos by score range and batch-select all filtered results
- **Custom Evaluation Criteria**: Add your own prompts to customize how photos are evaluated
- **Export**: Export selected photos as high-quality JPGs with sequential naming
- **100% Local**: All photos stored on your computer - nothing uploaded to the cloud
- **Secure**: API keys stored in your OS keychain

## Download

**[Download for macOS (Apple Silicon)](https://github.com/harj/photo-selector-app/releases/download/v1.0.0/Photo.Selector-1.0.0-arm64.dmg)** - M1/M2/M3 Macs

**[Download for macOS (Intel)](https://github.com/harj/photo-selector-app/releases/download/v1.0.0/Photo.Selector-1.0.0.dmg)** - Older Intel Macs

> **Note:** The app is not code-signed. On first launch, right-click the app and select "Open", then click "Open" again in the dialog to bypass Gatekeeper.

## Installation

### From DMG

1. Download the appropriate `.dmg` file for your Mac (Apple Silicon or Intel)
2. Open the DMG and drag Photo Selector to your Applications folder
3. Right-click the app and select "Open" (required for first launch since app is unsigned)
4. Click "Open" in the security dialog

### From Source

Requirements:
- Node.js 18+
- npm or yarn

```bash
# Clone the repository
git clone https://github.com/harj/photo-selector-app.git
cd photo-selector-app

# Install dependencies
npm install

# Rebuild native modules for Electron
npx electron-rebuild

# Run in development mode
npm run dev

# Build for production
npm run package
```

## Getting Started

1. **First Run**: On first launch, you'll be guided through setup:
   - Choose where to store your photos (default: ~/PhotoSelector)
   - Enter your [Anthropic API key](https://console.anthropic.com/settings/keys)

2. **Create a Project**: Click "New Project" and give it a name. Optionally add evaluation criteria.

3. **Upload Photos**: Click "Select Photos" to upload images. Supports JPG, PNG, HEIC, and RAW formats.

4. **Analyze**: Click "Analyze Photos" to have Claude score each photo. You'll see a cost estimate before proceeding.

5. **Group Similar**: Click "Group Similar" to automatically group burst shots and similar photos.

6. **Select & Export**: Check the photos you want to keep, then click "Export Selected".

## Development

```bash
# Run in development mode (with hot reload)
npm run dev

# Build main process only
npm run build:main

# Build renderer only
npm run build:renderer

# Build everything
npm run build

# Package for current platform
npm run package

# Package for specific platform
npm run package:mac
npm run package:win
npm run package:linux
```

## Project Structure

```
photo-selector-electron/
├── src/
│   ├── main/           # Electron main process (Node.js)
│   │   ├── index.ts    # Entry point
│   │   ├── services/   # Business logic
│   │   └── ...
│   ├── renderer/       # React frontend
│   │   ├── pages/      # Page components
│   │   ├── components/ # Reusable components
│   │   └── ...
│   ├── preload/        # Secure IPC bridge
│   └── shared/         # Shared types
├── resources/          # App icons
└── ...
```

## Tech Stack

- **Electron** - Desktop app framework
- **React** - UI framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **better-sqlite3** - Database
- **sharp** - Image processing
- **keytar** - Secure credential storage
- **@anthropic-ai/sdk** - Claude API

## Privacy & Data

**Your photos never leave your computer.** This app runs entirely locally:

- All original photos are stored on your local disk (in a folder you choose)
- Photos are **not** uploaded to any cloud service or server
- During AI analysis, only small compressed thumbnails (~400px) are sent to Claude's API
- Your original high-resolution files stay private on your machine
- API keys are stored in your operating system's secure keychain (macOS Keychain, Windows Credential Manager, or Linux Secret Service)
- No telemetry, analytics, or tracking of any kind

## How It Was Built

This entire application was built in a single conversation with [Claude Code](https://claude.ai/code), Anthropic's AI coding assistant. See [CLAUDE.md](CLAUDE.md) for the full story of how AI helped design, implement, and ship this app.

## License

MIT
