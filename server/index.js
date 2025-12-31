import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WindowsMediaProvider } from './providers/windows-media.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Windows Media provider
const mediaProvider = new WindowsMediaProvider();

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
    const track = await mediaProvider.getCurrentTrack();

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
    const track = await mediaProvider.getCurrentTrack();
    res.json(track || { playing: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
