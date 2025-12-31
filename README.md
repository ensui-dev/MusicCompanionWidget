# Noteworthy

A beautiful, customizable music widget that displays your currently playing song in OBS streams. Features a modern glassmorphism design with animated visualizer, progress bar, and album art.

## Features

- **Windows Media Session Integration**
  - Works with Spotify, Apple Music, iTunes, VLC, and any app that uses Windows media controls
  - Automatic album art fetching when not provided by the app

- **Beautiful Design**
  - Glassmorphism (frosted glass) aesthetic
  - Smooth animated audio visualizer
  - Album art display
  - Progress bar with time display
  - Multiple theme options (Glass, Dark, Light)

- **Easy OBS Integration**
  - Browser source compatible
  - Real-time updates via WebSocket
  - Transparent background ready
  - Configurable size

## Prerequisites: Installing Node.js

Before you can run this widget, you need to install Node.js (which includes npm).

### Windows Installation

1. **Download Node.js**
   - Go to [https://nodejs.org/](https://nodejs.org/)
   - Click the **LTS** (Long Term Support) version - this is the recommended version for most users
   - Download the Windows Installer (.msi)

2. **Run the Installer**
   - Double-click the downloaded `.msi` file
   - Click "Next" through the wizard
   - Accept the license agreement
   - Keep the default installation location
   - **Important:** Make sure "Add to PATH" is checked (it should be by default)
   - Click "Install" and wait for it to complete

3. **Verify Installation**
   - Open **Command Prompt** or **PowerShell** (search for it in the Start menu)
   - Type the following commands to verify:
     ```bash
     node --version
     npm --version
     ```
   - You should see version numbers (e.g., `v20.x.x` and `10.x.x`)

> **Note:** If the commands aren't recognized, try restarting your computer after installation.

---

## Quick Start

### 1. Download & Open the Project

Open **Command Prompt** or **PowerShell** and navigate to where you downloaded this project:

```bash
cd path\to\MusicCompanionWidget
```

### 2. Install Dependencies

```bash
npm install
```

This will download all the required packages (may take a minute or two).

### 3. Start the Server

```bash
npm start
```

You should see output showing the widget URLs. **Keep this window open** while streaming.

### 4. Add to OBS

1. In OBS, click **+** under Sources
2. Select **Browser**
3. Enter URL: `http://localhost:3000/widget`
4. Set dimensions: **450 x 150** (recommended)
5. Click OK

### 5. Configure Widget

Open `http://localhost:3000/config` in your browser to:
- Preview the widget
- Choose a theme
- Copy the widget URL

## Supported Music Apps

The widget works with any app that uses Windows Media Session, including:
- Spotify (Desktop app)
- Apple Music (Windows app)
- iTunes
- Windows Media Player
- VLC
- Most other media players

Just play music in any of these apps and the widget will automatically display it!

## URL Parameters

Customize the widget appearance with URL parameters:

| Parameter | Values | Description |
|-----------|--------|-------------|
| `theme` | `dark`, `light` | Widget theme (default: glass) |
| `preview` | `true` | Show gradient background for testing |

Examples:
- `http://localhost:3000/widget?theme=dark`
- `http://localhost:3000/widget?theme=light`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/widget` | GET | Widget page (for OBS) |
| `/config` | GET | Configuration interface |
| `/api/track` | GET | Current track info (JSON) |

## WebSocket Events

Connect to `ws://localhost:3000` to receive real-time updates:

```javascript
// Track update
{
  "type": "track",
  "data": {
    "playing": true,
    "title": "Song Name",
    "artist": "Artist Name",
    "album": "Album Name",
    "albumArt": "url or base64",
    "duration": 210000,
    "progress": 45000,
    "source": "windows"
  }
}
```

## Troubleshooting

### Widget shows "No music playing"
- Make sure music is actually playing
- Check that your music app appears in the Windows volume mixer

### Album art not showing
- The widget will automatically try to fetch album art from iTunes/Deezer if the app doesn't provide it
- Make sure you have an internet connection

### Widget not updating
- Check that the server is running
- Refresh the browser source in OBS
- Check browser console for WebSocket errors

## Development

```bash
# Run with auto-restart on changes
npm run dev
```

## License

MIT
