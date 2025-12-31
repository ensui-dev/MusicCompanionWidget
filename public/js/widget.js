class MusicWidget {
  constructor() {
    this.ws = null;
    this.currentTrack = null;
    this.isPlaying = false;

    // Progress tracking - pure local time based
    // We store the progress at a specific point in time, then calculate current progress from that
    this.syncedProgressMs = 0;    // Progress value when we last synced
    this.syncedAtTime = 0;        // System time (Date.now()) when we synced
    this.lastTrackId = null;      // To detect track changes
    this.wasPlaying = false;      // Previous playing state

    this.elements = {
      container: document.getElementById('widget-container'),
      albumArt: document.getElementById('album-art'),
      albumArtPlaceholder: document.getElementById('album-art-placeholder'),
      playingIndicator: document.getElementById('playing-indicator'),
      title: document.getElementById('track-title'),
      artist: document.getElementById('track-artist'),
      progressBar: document.getElementById('progress-bar'),
      currentTime: document.getElementById('current-time'),
      totalTime: document.getElementById('total-time'),
      visualizer: document.getElementById('visualizer'),
      idleState: document.getElementById('idle-state'),
      trackContent: document.getElementById('track-content')
    };

    this.init();
  }

  init() {
    this.connectWebSocket();
    this.setupVisualizer();
    this.startProgressTracking();
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to server');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      console.log('Disconnected, reconnecting...');
      setTimeout(() => this.connectWebSocket(), 3000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case 'track':
        this.updateTrack(message.data);
        break;
    }
  }

  updateTrack(track) {
    if (!track || !track.title) {
      this.showIdleState();
      return;
    }

    this.hideIdleState();

    // Create a track identifier
    const trackId = `${track.title}-${track.artist}`;
    const isNewTrack = trackId !== this.lastTrackId;
    const serverProgress = track.progress || 0;

    // Detect state changes that require a sync
    const playStateChanged = this.wasPlaying !== track.playing;

    // Detect seek: calculate where we think progress should be vs what server says
    const currentLocalProgress = this.getCurrentProgress();
    const drift = Math.abs(serverProgress - currentLocalProgress);
    const userSeeked = !isNewTrack && drift > 2500; // 2.5 second threshold for seek detection

    // Only sync progress on meaningful state changes
    if (isNewTrack || userSeeked || playStateChanged || this.lastTrackId === null) {
      this.syncedProgressMs = serverProgress;
      this.syncedAtTime = Date.now();
    }

    // Update state
    this.lastTrackId = trackId;
    this.currentTrack = track;
    this.wasPlaying = this.isPlaying;
    this.isPlaying = track.playing;

    // Update UI elements (not progress - that's handled by the render loop)
    this.elements.title.textContent = track.title;
    this.elements.artist.textContent = track.artist || 'Unknown Artist';

    // Album art
    if (track.albumArt) {
      this.elements.albumArt.src = track.albumArt;
      this.elements.albumArt.classList.remove('hidden');
      this.elements.albumArtPlaceholder.classList.remove('visible');
    } else {
      this.elements.albumArt.src = '';
      this.elements.albumArt.classList.add('hidden');
      this.elements.albumArtPlaceholder.classList.add('visible');
    }

    // Playing indicator
    if (track.playing) {
      this.elements.playingIndicator.classList.remove('paused');
      this.elements.container.classList.remove('not-playing');
      this.elements.visualizer.classList.remove('paused');
    } else {
      this.elements.playingIndicator.classList.add('paused');
      this.elements.container.classList.add('not-playing');
      this.elements.visualizer.classList.add('paused');
    }

    // Total time
    this.elements.totalTime.textContent = this.formatTime(track.duration);

    // Check if text needs scrolling
    this.checkTextOverflow();
  }

  // Calculate current progress based on synced time + elapsed system time
  getCurrentProgress() {
    if (!this.currentTrack || this.syncedAtTime === 0) return 0;

    if (this.isPlaying) {
      const elapsed = Date.now() - this.syncedAtTime;
      return Math.min(this.syncedProgressMs + elapsed, this.currentTrack.duration || 0);
    } else {
      return this.syncedProgressMs;
    }
  }

  updateProgressDisplay() {
    if (!this.currentTrack) return;

    const duration = this.currentTrack.duration || 1;
    const progress = this.getCurrentProgress();
    const percentage = Math.min((progress / duration) * 100, 100);

    this.elements.progressBar.style.width = `${percentage}%`;
    this.elements.currentTime.textContent = this.formatTime(progress);
  }

  startProgressTracking() {
    // Pure display update - no state changes, just reads from getCurrentProgress()
    const updateLoop = () => {
      this.updateProgressDisplay();
      requestAnimationFrame(updateLoop);
    };
    requestAnimationFrame(updateLoop);
  }

  formatTime(ms) {
    if (!ms || ms < 0) return '0:00';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  setupVisualizer() {
    const numBars = 12;
    this.elements.visualizer.innerHTML = '';

    for (let i = 0; i < numBars; i++) {
      const bar = document.createElement('div');
      bar.className = 'visualizer-bar';
      bar.style.height = '4px';
      this.elements.visualizer.appendChild(bar);
    }

    this.animateVisualizer();
  }

  animateVisualizer() {
    const bars = this.elements.visualizer.querySelectorAll('.visualizer-bar');

    const animate = () => {
      if (this.isPlaying) {
        bars.forEach((bar, index) => {
          // Create a wave-like pattern with some randomness
          const time = Date.now() / 150;
          const wave = Math.sin(time + index * 0.5) * 0.5 + 0.5;
          const random = Math.random() * 0.3;
          const height = 4 + (wave + random) * 26;
          bar.style.height = `${height}px`;
        });
      }
      requestAnimationFrame(animate);
    };

    animate();
  }

  checkTextOverflow() {
    // Check if title needs scrolling
    const titleEl = this.elements.title;
    if (titleEl.scrollWidth > titleEl.clientWidth) {
      titleEl.classList.add('scrolling');
    } else {
      titleEl.classList.remove('scrolling');
    }

    // Check if artist needs scrolling
    const artistEl = this.elements.artist;
    if (artistEl.scrollWidth > artistEl.clientWidth) {
      artistEl.classList.add('scrolling');
    } else {
      artistEl.classList.remove('scrolling');
    }
  }

  showIdleState() {
    this.elements.idleState.style.display = 'block';
    this.elements.trackContent.style.display = 'none';
    this.elements.container.classList.add('not-playing');
    this.elements.visualizer.classList.add('paused');
    this.isPlaying = false;
  }

  hideIdleState() {
    this.elements.idleState.style.display = 'none';
    this.elements.trackContent.style.display = 'flex';
  }
}

// Initialize widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new MusicWidget();
});

// Handle URL parameters for customization
const params = new URLSearchParams(window.location.search);

// Preview mode for testing
if (params.get('preview') === 'true') {
  document.body.classList.add('preview');
}

// Theme parameter
const theme = params.get('theme');
if (theme) {
  document.getElementById('widget-container')?.setAttribute('data-theme', theme);
}
