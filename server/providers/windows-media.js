import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class WindowsMediaProvider {
  constructor() {
    this.lastTrack = null;
    this.playbackStartTime = null;
    this.scriptPath = join(__dirname, '../scripts/get-media-info.ps1');
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
}
