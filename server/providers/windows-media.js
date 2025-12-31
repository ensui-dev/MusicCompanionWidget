import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class WindowsMediaProvider {
  constructor() {
    this.lastTrack = null;
    this.playbackStartTime = null;
  }

  async getCurrentTrack() {
    try {
      // PowerShell script to get Windows Media Session info
      // This works with Spotify, Apple Music, iTunes, Windows Media Player, etc.
      const psScript = `
        Add-Type -AssemblyName System.Runtime.WindowsRuntime

        $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]

        Function Await($WinRtTask, $ResultType) {
            $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
            $netTask = $asTask.Invoke($null, @($WinRtTask))
            $netTask.Wait(-1) | Out-Null
            $netTask.Result
        }

        Function AwaitAction($WinRtAction) {
            $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and !$_.IsGenericMethod })[0]
            $netTask = $asTask.Invoke($null, @($WinRtAction))
            $netTask.Wait(-1) | Out-Null
        }

        [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null
        [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

        $sessionManager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
        $session = $sessionManager.GetCurrentSession()

        if ($null -eq $session) {
            Write-Output '{"playing":false,"error":"No media session"}'
            exit
        }

        $mediaProperties = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
        $playbackInfo = $session.GetPlaybackInfo()
        $timelineProperties = $session.GetTimelineProperties()

        $isPlaying = $playbackInfo.PlaybackStatus -eq 'Playing'

        # Try to get thumbnail
        $thumbnailBase64 = ""
        if ($null -ne $mediaProperties.Thumbnail) {
            try {
                $stream = Await ($mediaProperties.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
                $reader = New-Object Windows.Storage.Streams.DataReader($stream)
                Await ($reader.LoadAsync($stream.Size)) ([uint32]) | Out-Null
                $bytes = New-Object byte[] $stream.Size
                $reader.ReadBytes($bytes)
                $thumbnailBase64 = [Convert]::ToBase64String($bytes)
                $reader.Dispose()
                $stream.Dispose()
            } catch {
                # Thumbnail extraction failed, continue without it
            }
        }

        $result = @{
            playing = $isPlaying
            title = $mediaProperties.Title
            artist = $mediaProperties.Artist
            album = $mediaProperties.AlbumTitle
            albumArt = if ($thumbnailBase64) { "data:image/png;base64,$thumbnailBase64" } else { $null }
            duration = [int]$timelineProperties.EndTime.TotalMilliseconds
            progress = [int]$timelineProperties.Position.TotalMilliseconds
            source = "windows"
            appName = $session.SourceAppUserModelId
        }

        $result | ConvertTo-Json -Compress
      `;

      const { stdout, stderr } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
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
      // Check if it's a non-Windows system
      if (process.platform !== 'win32') {
        return {
          playing: false,
          error: 'Windows Media Session is only available on Windows'
        };
      }

      console.error('Windows Media error:', error.message);
      return {
        playing: false,
        error: error.message
      };
    }
  }
}
