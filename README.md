# Photo Selector

AI-powered photo selection tool that helps you choose the best photos from a batch using Claude's vision capabilities.

## Features

- **Smart Photo Analysis**: Claude AI scores and comments on each photo based on composition, lighting, focus, and emotional impact
- **Similarity Grouping**: Automatically groups similar photos (burst shots, duplicates) and shows only the best from each group
- **Score Filtering**: Filter photos by score range and batch-select all filtered results
- **Custom Evaluation Criteria**: Add your own prompts to customize how photos are evaluated
- **Export**: Export selected photos as high-quality JPGs with sequential naming
- **Secure**: API keys stored in your OS keychain, photos never leave your machine except for AI analysis

## Installation

### From Release

Download the latest release for your platform:
- **macOS**: Download the `.dmg` file, open it, and drag Photo Selector to Applications
- **Windows**: Download the `.exe` installer and run it
- **Linux**: Download the `.AppImage`, make it executable, and run it

### From Source

Requirements:
- Node.js 18+
- npm or yarn

```bash
# Clone the repository
git clone https://github.com/harj/photo-selector.git
cd photo-selector

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

## Privacy

- Photos are stored locally on your machine
- Only thumbnail images are sent to Claude's API for analysis
- API keys are stored in your operating system's secure keychain
- No telemetry or tracking

## License

MIT
