import fetch from 'node-fetch';

export class SpotifyProvider {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/spotify/callback';

    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  hasCredentials() {
    return !!(this.clientId && this.clientSecret);
  }

  isAuthenticated() {
    return !!(this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry);
  }

  getAuthUrl() {
    const scopes = [
      'user-read-currently-playing',
      'user-read-playback-state'
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: this.redirectUri,
      scope: scopes,
      show_dialog: 'true'
    });

    return `https://accounts.spotify.com/authorize?${params}`;
  }

  async handleCallback(code) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);

    return data;
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
      })
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);

    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }

    return data;
  }

  async ensureToken() {
    if (!this.accessToken) {
      return false;
    }

    // Refresh if token expires in less than 5 minutes
    if (this.tokenExpiry && Date.now() > this.tokenExpiry - 300000) {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        console.error('Failed to refresh token:', error);
        return false;
      }
    }

    return true;
  }

  async getCurrentTrack() {
    if (!this.hasCredentials()) {
      return {
        playing: false,
        error: 'Spotify credentials not configured'
      };
    }

    const hasToken = await this.ensureToken();
    if (!hasToken) {
      return {
        playing: false,
        needsAuth: true
      };
    }

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      // No content means nothing is playing
      if (response.status === 204) {
        return { playing: false };
      }

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          await this.refreshAccessToken();
          return this.getCurrentTrack();
        }
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.item) {
        return { playing: false };
      }

      // Extract album art (prefer medium size ~300px)
      const albumArt = data.item.album?.images?.find(img => img.width === 300)?.url
        || data.item.album?.images?.[0]?.url
        || null;

      return {
        playing: data.is_playing,
        title: data.item.name,
        artist: data.item.artists.map(a => a.name).join(', '),
        album: data.item.album?.name,
        albumArt,
        duration: data.item.duration_ms,
        progress: data.progress_ms,
        source: 'spotify'
      };
    } catch (error) {
      console.error('Spotify getCurrentTrack error:', error);
      return {
        playing: false,
        error: error.message
      };
    }
  }
}
