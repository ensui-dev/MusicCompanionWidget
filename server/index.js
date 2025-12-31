import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir, readFile, writeFile, unlink, mkdir, stat } from 'fs/promises';
import multer from 'multer';
import sanitizeHtml from 'sanitize-html';
import { WindowsMediaProvider } from './providers/windows-media.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const THEMES_DIR = join(__dirname, '../themes');
const BUILTIN_THEMES = ['glass', 'dark', 'light', 'vaporwave', 'retro', 'custom'];

// Theme upload configuration
const themeStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await mkdir(THEMES_DIR, { recursive: true });
    cb(null, THEMES_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '-')
      .toLowerCase();
    cb(null, safeName);
  }
});

const themeUpload = multer({
  storage: themeStorage,
  limits: { fileSize: 512 * 1024 }, // 512KB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/html' || file.originalname.endsWith('.html')) {
      cb(null, true);
    } else {
      cb(new Error('Only HTML files are allowed'));
    }
  }
});

// Theme validation - check for required element IDs
function validateTheme(html) {
  const requiredIds = [
    'widget-container', 'idle-state', 'track-content',
    'album-art', 'track-title', 'track-artist',
    'progress-bar', 'current-time', 'total-time', 'visualizer'
  ];

  for (const id of requiredIds) {
    if (!html.includes(`id="${id}"`)) {
      return { valid: false, error: `Missing required element with id="${id}"` };
    }
  }

  // Check for dangerous content
  const dangerousPatterns = [
    /<script[^>]*src=/i,
    /javascript:/i,
    /on\w+\s*=/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(html)) {
      return { valid: false, error: 'Theme contains potentially dangerous content' };
    }
  }

  return { valid: true };
}

// Sanitize theme HTML
function sanitizeThemeHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'style', 'svg', 'path', 'circle', 'rect', 'line', 'polyline',
      'polygon', 'g', 'defs', 'linearGradient', 'stop', 'radialGradient', 'img'
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['id', 'class', 'style', 'data-*'],
      'svg': ['viewBox', 'fill', 'stroke', 'stroke-width', 'xmlns', 'width', 'height'],
      'path': ['d', 'fill', 'stroke'],
      'circle': ['cx', 'cy', 'r', 'fill', 'stroke'],
      'rect': ['x', 'y', 'width', 'height', 'fill', 'stroke', 'rx', 'ry'],
      'linearGradient': ['id', 'x1', 'y1', 'x2', 'y2'],
      'radialGradient': ['id', 'cx', 'cy', 'r'],
      'stop': ['offset', 'stop-color', 'stop-opacity'],
      'img': ['src', 'alt', 'id', 'class']
    },
    allowedSchemes: ['data', 'http', 'https'],
    allowVulnerableTags: true
  });
}

// Extract theme metadata from HTML comment
function extractThemeMetadata(html) {
  const metadata = { name: null, author: null, version: null, description: null };
  const commentMatch = html.match(/<!--([\s\S]*?)-->/);
  if (commentMatch) {
    const comment = commentMatch[1];
    const nameMatch = comment.match(/Theme:\s*(.+)/i);
    const authorMatch = comment.match(/Author:\s*(.+)/i);
    const versionMatch = comment.match(/Version:\s*(.+)/i);
    const descMatch = comment.match(/Description:\s*(.+)/i);
    if (nameMatch) metadata.name = nameMatch[1].trim();
    if (authorMatch) metadata.author = authorMatch[1].trim();
    if (versionMatch) metadata.version = versionMatch[1].trim();
    if (descMatch) metadata.description = descMatch[1].trim();
  }
  return metadata;
}

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Windows Media provider
const mediaProvider = new WindowsMediaProvider();

let currentTrack = null;
let pollingInterval = null;

// State tracking for change detection
let lastTrackId = null;
let lastPlayingState = null;
let lastProgressMs = null;

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

    // Create track identifier
    const trackId = track ? `${track.title}-${track.artist}` : null;

    // Detect meaningful state changes
    const isNewTrack = trackId !== lastTrackId;
    const playStateChanged = lastPlayingState !== null && lastPlayingState !== track?.playing;

    // Detect seek: large jump in progress (more than 2.5 seconds from expected)
    // Expected progress = lastProgress + poll interval (1000ms) if playing
    let userSeeked = false;
    if (track && lastProgressMs !== null && !isNewTrack) {
      const expectedProgress = lastPlayingState ? lastProgressMs + 1500 : lastProgressMs; // 1.5s tolerance
      const actualProgress = track.progress || 0;
      const drift = Math.abs(actualProgress - expectedProgress);
      userSeeked = drift > 2500; // User seeked if drift > 2.5 seconds
    }

    // Determine if we should broadcast (only on state changes)
    const shouldBroadcast = isNewTrack || playStateChanged || userSeeked || lastTrackId === null;

    // Update state tracking
    lastTrackId = trackId;
    lastPlayingState = track?.playing ?? null;
    lastProgressMs = track?.progress ?? null;
    currentTrack = track;

    // Only broadcast on meaningful state changes
    if (shouldBroadcast) {
      if (track) {
        console.log(`Broadcasting: ${isNewTrack ? 'new track' : ''} ${playStateChanged ? 'play state changed' : ''} ${userSeeked ? 'user seeked' : ''}`);
        broadcast({
          type: 'track',
          data: track
        });
      } else {
        broadcast({ type: 'track', data: null });
      }
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

// Widget page (for OBS browser source) - supports custom themes
app.get('/widget', async (req, res) => {
  const customThemeId = req.query.customTheme;

  if (customThemeId) {
    try {
      const themePath = join(THEMES_DIR, `${customThemeId}.html`);
      let themeHtml = await readFile(themePath, 'utf-8');

      // Inject the widget.js script if not present
      if (!themeHtml.includes('widget.js')) {
        themeHtml = themeHtml.replace('</body>', '<script src="/js/widget.js"></script>\n</body>');
      }

      // Inject base CSS for essential animations if not present
      if (!themeHtml.includes('widget-base.css')) {
        themeHtml = themeHtml.replace('</head>', '<link rel="stylesheet" href="/css/widget-base.css">\n</head>');
      }

      res.type('text/html').send(themeHtml);
    } catch (error) {
      // Fallback to default widget
      res.sendFile(join(__dirname, '../public/widget.html'));
    }
  } else {
    res.sendFile(join(__dirname, '../public/widget.html'));
  }
});

// Config page
app.get('/config', (req, res) => {
  res.sendFile(join(__dirname, '../public/config.html'));
});

// Theme API Routes

// Upload a new theme
app.post('/api/themes/upload', themeUpload.single('theme'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const content = await readFile(filePath, 'utf-8');

    // Validate theme structure
    const validation = validateTheme(content);
    if (!validation.valid) {
      await unlink(filePath);
      return res.status(400).json({ error: validation.error });
    }

    // Sanitize HTML and save
    const sanitized = sanitizeThemeHtml(content);
    await writeFile(filePath, sanitized, 'utf-8');

    // Extract metadata
    const metadata = extractThemeMetadata(content);

    res.json({
      success: true,
      theme: {
        id: req.file.filename.replace('.html', ''),
        name: metadata.name || req.file.filename.replace('.html', ''),
        filename: req.file.filename,
        author: metadata.author,
        description: metadata.description
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all themes
app.get('/api/themes', async (req, res) => {
  try {
    const themes = {
      builtin: BUILTIN_THEMES.map(id => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        builtin: true
      })),
      custom: []
    };

    try {
      const files = await readdir(THEMES_DIR);
      for (const file of files) {
        if (file.endsWith('.html')) {
          const content = await readFile(join(THEMES_DIR, file), 'utf-8');
          const metadata = extractThemeMetadata(content);
          themes.custom.push({
            id: file.replace('.html', ''),
            name: metadata.name || file.replace('.html', ''),
            filename: file,
            author: metadata.author,
            description: metadata.description,
            builtin: false
          });
        }
      }
    } catch (e) {
      // themes directory doesn't exist yet
    }

    res.json(themes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific theme
app.get('/api/themes/:id', async (req, res) => {
  try {
    const themeId = req.params.id;
    const filePath = join(THEMES_DIR, `${themeId}.html`);

    const stats = await stat(filePath);
    if (!stats.isFile()) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    const content = await readFile(filePath, 'utf-8');
    res.type('text/html').send(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete a theme
app.delete('/api/themes/:id', async (req, res) => {
  try {
    const themeId = req.params.id;
    const filePath = join(THEMES_DIR, `${themeId}.html`);

    await unlink(filePath);
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Download theme template
app.get('/api/themes/template/download', (req, res) => {
  const template = `<!--
  Theme: My Custom Theme
  Author: Your Name
  Version: 1.0
  Description: A custom theme for Noteworthy
-->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Custom Theme - Noteworthy</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', sans-serif;
      background: transparent;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px;
    }

    body.preview {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .widget-container {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(20px);
      max-width: 450px;
      width: 100%;
    }

    .album-art-container { position: relative; flex-shrink: 0; }

    .album-art {
      width: 100px;
      height: 100px;
      border-radius: 12px;
      object-fit: cover;
    }

    .album-art.hidden { display: none; }

    .album-art-placeholder {
      width: 100px;
      height: 100px;
      border-radius: 12px;
      background: rgba(255,255,255,0.1);
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 32px;
    }

    .album-art-placeholder.visible { display: flex; }

    .playing-indicator {
      position: absolute;
      bottom: -4px;
      right: -4px;
      width: 16px;
      height: 16px;
      background: #1DB954;
      border-radius: 50%;
    }

    .playing-indicator.paused { background: #ff9500; }

    .track-info { flex: 1; min-width: 0; }

    .track-title {
      font-size: 18px;
      font-weight: 600;
      color: white;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .track-artist {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.8);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .progress-bar-container {
      height: 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      margin-top: 8px;
    }

    .progress-bar {
      height: 100%;
      background: #1DB954;
      border-radius: 3px;
      width: 0%;
      transition: width 0.3s linear;
    }

    .time-info {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 4px;
    }

    .visualizer {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 30px;
    }

    .idle-message {
      text-align: center;
      color: rgba(255, 255, 255, 0.7);
      padding: 20px;
      width: 100%;
    }

    .idle-message .icon { font-size: 32px; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div id="widget-container" class="widget-container">
    <div id="idle-state" class="idle-message">
      <div class="icon">🎵</div>
      <div>No music playing</div>
    </div>

    <div id="track-content" style="display: none; align-items: center; gap: 16px; width: 100%;">
      <div class="album-art-container">
        <img id="album-art" class="album-art hidden" alt="">
        <div id="album-art-placeholder" class="album-art-placeholder visible">🎵</div>
        <div id="playing-indicator" class="playing-indicator paused"></div>
      </div>

      <div class="track-info">
        <div id="track-title" class="track-title">Song Title</div>
        <div id="track-artist" class="track-artist">Artist Name</div>

        <div class="progress-section">
          <div class="progress-bar-container">
            <div id="progress-bar" class="progress-bar"></div>
          </div>
          <div class="time-info">
            <span id="current-time">0:00</span>
            <span id="total-time">0:00</span>
          </div>
        </div>
      </div>

      <div id="visualizer" class="visualizer"></div>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Disposition', 'attachment; filename="theme-template.html"');
  res.type('text/html').send(template);
});

// Start server
server.listen(PORT, () => {
  console.log(`\n🎵 Noteworthy Server`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📺 Widget URL:  http://localhost:${PORT}/widget`);
  console.log(`⚙️  Config URL:  http://localhost:${PORT}/config`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`Add the Widget URL as a Browser Source in OBS`);
  console.log(`Recommended size: 400x150 pixels\n`);

  startPolling();
});
