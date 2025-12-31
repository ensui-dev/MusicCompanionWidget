import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { SpotifyProvider } from './providers/spotify.js';
import { WindowsMediaProvider } from './providers/windows-media.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Provider instances
const providers = {
  spotify: new SpotifyProvider(),
  windows: new WindowsMediaProvider()
};

let currentProvider = process.env.DEFAULT_PROVIDER || 'windows';
let currentTrack = null;
let pollingInterval = null;

// WebSocket connections
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Client connected');

  // Send current track immediately on connection
  if (currentTrack) {
    ws.send(JSON.stringify({ type: 'track', data: currentTrack }));
  }

  // Send current provider
  ws.send(JSON.stringify({ type: 'provider', data: currentProvider }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected');
  });
});

function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data);
    }
  });
}

// Polling function to get current track
async function pollCurrentTrack() {
  try {
    const provider = providers[currentProvider];
    if (!provider) return;

    const track = await provider.getCurrentTrack();

    // Check if track changed
    const trackChanged = !currentTrack ||
      currentTrack.title !== track?.title ||
      currentTrack.artist !== track?.artist;

    currentTrack = track;

    if (track) {
      broadcast({
        type: 'track',
        data: track,
        changed: trackChanged
      });
    } else {
      broadcast({ type: 'track', data: null });
    }
  } catch (error) {
    console.error('Error polling track:', error.message);
  }
}

// Start polling
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(pollCurrentTrack, 1000);
  pollCurrentTrack(); // Initial poll
}

// API Routes

// Get current track
app.get('/api/track', async (req, res) => {
  try {
    const provider = providers[currentProvider];
    const track = await provider.getCurrentTrack();
    res.json(track || { playing: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get/Set provider
app.get('/api/provider', (req, res) => {
  res.json({
    current: currentProvider,
    available: Object.keys(providers)
  });
});

app.post('/api/provider', (req, res) => {
  const { provider } = req.body;
  if (providers[provider]) {
    currentProvider = provider;
    broadcast({ type: 'provider', data: currentProvider });
    res.json({ success: true, provider: currentProvider });
  } else {
    res.status(400).json({ error: 'Invalid provider' });
  }
});

// Spotify OAuth routes
app.get('/api/spotify/auth', (req, res) => {
  const authUrl = providers.spotify.getAuthUrl();
  res.redirect(authUrl);
});

app.get('/api/spotify/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.send(`<script>window.close();</script><p>Authorization denied: ${error}</p>`);
  }

  try {
    await providers.spotify.handleCallback(code);
    res.send(`
      <html>
        <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e;">
          <div style="text-align: center; color: white;">
            <h2 style="color: #1DB954;">✓ Spotify Connected!</h2>
            <p>You can close this window and return to the widget.</p>
            <script>setTimeout(() => window.close(), 2000);</script>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`<p>Error: ${err.message}</p>`);
  }
});

app.get('/api/spotify/status', (req, res) => {
  res.json({
    authenticated: providers.spotify.isAuthenticated(),
    hasCredentials: providers.spotify.hasCredentials()
  });
});

// Widget page (for OBS browser source)
app.get('/widget', (req, res) => {
  res.sendFile(join(__dirname, '../public/widget.html'));
});

// Config page
app.get('/config', (req, res) => {
  res.sendFile(join(__dirname, '../public/config.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`\n🎵 Music Companion Widget Server`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📺 Widget URL:  http://localhost:${PORT}/widget`);
  console.log(`⚙️  Config URL:  http://localhost:${PORT}/config`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`Add the Widget URL as a Browser Source in OBS`);
  console.log(`Recommended size: 400x150 pixels\n`);

  startPolling();
});
