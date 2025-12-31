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

## Quick Start

### 1. Install Dependencies

```bash
cd MusicCompanionWidget
npm install
```

### 2. Configure (Optional)

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` if you want to use Spotify Web API (see Spotify Setup below).

### 3. Start the Server

```bash
npm start
```

### 4. Add to OBS

1. In OBS, click **+** under Sources
2. Select **Browser**
3. Enter URL: `http://localhost:3000/widget`
4. Set dimensions: **450 x 150** (recommended)
5. Click OK

### 5. Configure Widget

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
