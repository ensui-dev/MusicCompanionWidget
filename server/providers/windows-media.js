import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class WindowsMediaProvider {
  constructor() {
    this.lastTrack = null;
    this.playbackStartTime = null;
    this.scriptPath = join(__dirname, '../scripts/get-media-info.ps1');
    // Cache album art lookups to avoid repeated API calls
    this.albumArtCache = new Map();
  }

  async getCurrentTrack() {
    // Check if it's a non-Windows system
    if (process.platform !== 'win32') {
      return {
        playing: false,
        error: 'Windows Media Session is only available on Windows'
      };
    }

    try {
      // Execute the external PowerShell script
      const { stdout, stderr } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${this.scriptPath}"`,
        { timeout: 5000 }
      );

      if (stderr && !stdout) {
        console.error('PowerShell stderr:', stderr);
        return { playing: false, error: 'PowerShell error' };
      }

      const result = JSON.parse(stdout.trim());

      // If no album art from Windows Media Session, try to fetch from MusicBrainz/Cover Art Archive
      if (result.title && !result.albumArt) {
        result.albumArt = await this.fetchAlbumArt(result.title, result.artist, result.album);
      }

      // Track progress locally for smoother updates when playing
      if (result.playing && result.title) {
        if (!this.lastTrack || this.lastTrack.title !== result.title) {
          this.playbackStartTime = Date.now() - result.progress;
        }
        this.lastTrack = result;
      } else {
        this.lastTrack = null;
        this.playbackStartTime = null;
      }

      return result;
    } catch (error) {
      console.error('Windows Media error:', error.message);
      return {
        playing: false,
        error: error.message
      };
    }
  }

  async fetchAlbumArt(title, artist, album) {
    // Create a cache key
    const cacheKey = `${artist || ''}-${album || title}`.toLowerCase().trim();

    // Check cache first
    if (this.albumArtCache.has(cacheKey)) {
      return this.albumArtCache.get(cacheKey);
    }

    try {
      // Try iTunes Search API first (fast and reliable)
      const searchTerm = encodeURIComponent(`${artist || ''} ${album || title}`.trim());
      const itunesUrl = `https://itunes.apple.com/search?term=${searchTerm}&media=music&entity=album&limit=1`;

      const itunesResponse = await fetch(itunesUrl, { timeout: 3000 });
      if (itunesResponse.ok) {
        const itunesData = await itunesResponse.json();
        if (itunesData.results && itunesData.results.length > 0) {
          // Get higher resolution artwork (replace 100x100 with 600x600)
          const artworkUrl = itunesData.results[0].artworkUrl100?.replace('100x100', '600x600');
          if (artworkUrl) {
            this.albumArtCache.set(cacheKey, artworkUrl);
            // Limit cache size
            if (this.albumArtCache.size > 100) {
              const firstKey = this.albumArtCache.keys().next().value;
              this.albumArtCache.delete(firstKey);
            }
            return artworkUrl;
          }
        }
      }

      // Fallback: Try Deezer API
      const deezerUrl = `https://api.deezer.com/search/album?q=${searchTerm}&limit=1`;
      const deezerResponse = await fetch(deezerUrl, { timeout: 3000 });
      if (deezerResponse.ok) {
        const deezerData = await deezerResponse.json();
        if (deezerData.data && deezerData.data.length > 0) {
          const artworkUrl = deezerData.data[0].cover_big || deezerData.data[0].cover_medium;
          if (artworkUrl) {
            this.albumArtCache.set(cacheKey, artworkUrl);
            if (this.albumArtCache.size > 100) {
              const firstKey = this.albumArtCache.keys().next().value;
              this.albumArtCache.delete(firstKey);
            }
            return artworkUrl;
          }
        }
      }

      // Cache null result to avoid repeated failed lookups
      this.albumArtCache.set(cacheKey, null);
      return null;
    } catch (error) {
      console.error('Album art fetch error:', error.message);
      return null;
    }
  }
}
