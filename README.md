# Music Companion Widget for OBS

A beautiful, customizable music widget that displays your currently playing song in OBS streams. Features a modern glassmorphism design with animated visualizer, progress bar, and album art.

![Widget Preview](docs/preview.png)

## Features

- **Multiple Music Sources**
  - **Windows Media Session** - Works with Apple Music, Spotify, iTunes, VLC, and any app that uses Windows media controls
  - **Spotify Web API** - Direct integration with Spotify for more detailed information

- **Beautiful Design**
  - Glassmorphism (frosted glass) aesthetic
  - Smooth animated audio visualizer
  - Album art with source indicator
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

### 3. Configure (Optional)

Copy the example environment file:

```bash
copy .env.example .env
```

Edit `.env` with Notepad if you want to use Spotify Web API (see Spotify Setup below).

### 4. Start the Server

```bash
npm start
```

You should see output showing the widget URLs. **Keep this window open** while streaming.

### 5. Add to OBS

1. In OBS, click **+** under Sources
2. Select **Browser**
3. Enter URL: `http://localhost:3000/widget`
4. Set dimensions: **450 x 150** (recommended)
5. Click OK

### 6. Configure Widget

Open `http://localhost:3000/config` in your browser to:
- Select music source (Windows Media or Spotify)
- Preview the widget
- Choose a theme
- Copy the widget URL

## Music Source Options

### Windows Media Session (Recommended)

This is the easiest option and works with most music applications on Windows, including:
- Apple Music (Windows app)
- Spotify (Desktop app)
- iTunes
- Windows Media Player
- VLC
- Most other media players

No configuration required - just select "Windows Media" in the config page.

### Spotify Web API

For more detailed track information directly from Spotify:

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in and create a new application
3. In your app settings, add this Redirect URI:
   ```
   http://localhost:3000/api/spotify/callback
   ```
4. Copy your **Client ID** and **Client Secret**
5. Add them to your `.env` file:
   ```
   SPOTIFY_CLIENT_ID=your_client_id
   SPOTIFY_CLIENT_SECRET=your_client_secret
   ```
6. Restart the server
7. Go to the config page and click "Connect Spotify"

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
| `/api/provider` | GET | List available providers |
| `/api/provider` | POST | Change active provider |
| `/api/spotify/auth` | GET | Start Spotify OAuth |
| `/api/spotify/status` | GET | Check Spotify connection |

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
    "source": "spotify" // or "windows"
  }
}

// Provider change
{
  "type": "provider",
  "data": "spotify" // or "windows"
}
```

## Troubleshooting

### Widget shows "No music playing"
- Make sure music is actually playing
- For Windows Media: Check that your music app appears in the Windows volume mixer
- For Spotify: Make sure you've connected your account in the config page

### Album art not showing
- Some apps don't provide album art through Windows Media Session
- Try using Spotify Web API for better album art support

### Widget not updating
- Check that the server is running
- Refresh the browser source in OBS
- Check browser console for WebSocket errors

### Spotify connection fails
- Verify your Client ID and Secret are correct
- Make sure the redirect URI matches exactly
- Check that you've added the redirect URI in Spotify Dashboard

## Development

```bash
# Run with auto-restart on changes
npm run dev
```

## License

MIT
