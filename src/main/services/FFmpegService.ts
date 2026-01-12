import ffmpeg from 'fluent-ffmpeg'
import type { VideoMetadata, ExportOptions } from '../../shared/types'

// Set ffmpeg paths for macOS (Homebrew)
const ffmpegPath = '/opt/homebrew/bin/ffmpeg'
const ffprobePath = '/opt/homebrew/bin/ffprobe'
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

// Check if VideoToolbox is available (Apple Silicon hardware encoding)
let useVideoToolbox = false
try {
  const { execSync } = require('child_process')
  const encoders = execSync(`${ffmpegPath} -encoders 2>/dev/null | grep videotoolbox`, {
    encoding: 'utf-8'
  })
  useVideoToolbox = encoders.includes('h264_videotoolbox')
} catch {
  useVideoToolbox = false
}

// Type for ffmpeg progress
interface FFmpegProgress {
  percent?: number
  currentFps?: number
  timemark?: string
}

/**
 * Escape a file path for use in FFmpeg filter expressions with single quotes.
 *
 * When using single quotes around the path in FFmpeg filter syntax,
 * we only need to escape single quotes and backslashes within the path.
 * The single quotes handle spaces and most special characters.
 *
 * @param filePath - The file path to escape
 * @returns The escaped path suitable for use inside single quotes in FFmpeg filters
 *
 * @example
 * // macOS path with spaces - will be used as: subtitles='/path/to/file.ass'
 * escapeFFmpegFilterPath('/Users/name/Application Support/file.ass')
 * // Returns: /Users/name/Application Support/file.ass (unchanged, quotes handle spaces)
 *
 * @example
 * // Path with single quote
 * escapeFFmpegFilterPath("/Users/name/it's a file.ass")
 * // Returns: /Users/name/it'\''s a file.ass
 */
export function escapeFFmpegFilterPath(filePath: string): string {
  // When using single quotes, we need to:
  // 1. Escape existing single quotes by ending the quote, adding escaped quote, starting new quote
  // 2. Escape colons which are special in FFmpeg filter syntax
  return filePath
    .replace(/'/g, "'\\''")  // Escape single quotes for shell
    .replace(/:/g, '\\:')    // Escape colons for FFmpeg filter syntax
}

export class FFmpegService {
  private currentCommand: ffmpeg.FfmpegCommand | null = null

  /**
   * Extract audio from video file
   */
  async extractAudio(videoPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .output(outputPath)
        .on('end', () => {
          resolve(outputPath)
        })
        .on('error', (err) => {
          reject(new Error(`Audio extraction failed: ${err.message}`))
        })
        .run()
    })
  }

  /**
   * Get video metadata
   */
  async getMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get metadata: ${err.message}`))
          return
        }

        const videoStream = metadata.streams.find((s) => s.codec_type === 'video')
        const audioStream = metadata.streams.find((s) => s.codec_type === 'audio')

        if (!videoStream) {
          reject(new Error('No video stream found'))
          return
        }

        // Parse frame rate
        let fps = 30
        if (videoStream.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/').map(Number)
          fps = den ? num / den : num
        }

        resolve({
          duration: metadata.format.duration || 0,
          width: videoStream.width || 1920,
          height: videoStream.height || 1080,
          fps,
          codec: videoStream.codec_name || 'unknown',
          audioCodec: audioStream?.codec_name || 'unknown'
        })
      })
    })
  }

  /**
   * Export video with burned-in subtitles
   * Uses VideoToolbox hardware encoding on Apple Silicon for 3-4x faster exports
   */
  async exportWithSubtitles(
    videoPath: string,
    subtitlePath: string,
    options: ExportOptions,
    onProgress?: (progress: { percent: number; fps: number; time: number }) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Build filter string for subtitle burning
      // Escape path for FFmpeg filter syntax (colons and quotes)
      const escapedSubPath = escapeFFmpegFilterPath(subtitlePath)

      // Use force_style to ensure fonts render correctly
      // If the specified font isn't found, libass will use a fallback
      // We set a sans-serif fallback chain that's available on all systems
      const subtitleFilter = `subtitles='${escapedSubPath}'`

      // Build scale filter if needed
      const filters: string[] = []
      if (options.scale && options.scale !== 1) {
        filters.push(`scale=iw*${options.scale}:ih*${options.scale}`)
      }
      filters.push(subtitleFilter)

      // Quality settings using bitrate for predictable file sizes
      // Bitrates are based on resolution - we'll calculate dynamically
      const qualityMultiplier = {
        high: 1.0,      // Full quality
        medium: 0.65,   // ~65% of high
        low: 0.4        // ~40% of high
      }[options.quality]

      // Software encoding quality settings (fallback)
      const softwareQuality = {
        high: { crf: 18, preset: 'slow' },
        medium: { crf: 23, preset: 'medium' },
        low: { crf: 28, preset: 'fast' }
      }[options.quality]

      const command = ffmpeg(videoPath)
        .videoFilters(filters.join(','))

      // Use VideoToolbox hardware encoding if available (Apple Silicon)
      // This is 3-4x faster than software encoding and uses the dedicated Media Engine
      if (useVideoToolbox) {
        // Calculate bitrate based on resolution
        // Base rates: 4K=50Mbps, 1080p=12Mbps, 720p=6Mbps
        // We'll use a high base rate and let the multiplier adjust
        const baseBitrate = 50  // Mbps for 4K base
        const targetBitrate = Math.round(baseBitrate * qualityMultiplier)

        command
          .videoCodec('h264_videotoolbox')
          .addOptions([
            `-b:v ${targetBitrate}M`,  // Target bitrate
            `-maxrate ${Math.round(targetBitrate * 1.5)}M`,  // Max bitrate (1.5x target)
            `-bufsize ${Math.round(targetBitrate * 2)}M`,    // Buffer size (2x target)
            '-profile:v high',         // High profile for better compression
            '-level 5.2',              // Level 5.2 for 4K support
            '-allow_sw 1',             // Allow software fallback if needed
            '-realtime 0'              // Disable realtime mode for better quality
          ])
          .audioCodec('aac_at')        // Use AudioToolbox for audio (also hardware accelerated)
          .audioBitrate('256k')        // Higher audio bitrate
      } else {
        // Software encoding fallback
        command
          .videoCodec('libx264')
          .addOptions([`-crf ${softwareQuality.crf}`, `-preset ${softwareQuality.preset}`])
          .audioCodec('aac')
          .audioBitrate('192k')
      }

      command
        .output(options.outputPath)
        .on('progress', (progress: FFmpegProgress) => {
          if (onProgress) {
            // Parse timemark to seconds
            let time = 0
            if (progress.timemark) {
              const parts = progress.timemark.split(':').map(Number)
              time = parts[0] * 3600 + parts[1] * 60 + parts[2]
            }

            onProgress({
              percent: progress.percent || 0,
              fps: progress.currentFps || 0,
              time
            })
          }
        })
        .on('end', () => {
          this.currentCommand = null
          resolve(options.outputPath)
        })
        .on('error', (err) => {
          this.currentCommand = null
          reject(new Error(`Export failed: ${err.message}`))
        })

      this.currentCommand = command
      command.run()
    })
  }

  /**
   * Cancel current operation
   */
  cancel(): void {
    if (this.currentCommand) {
      this.currentCommand.kill('SIGTERM')
      this.currentCommand = null
    }
  }
}

/**
 * Generate a thumbnail from a video file
 * @param videoPath Path to the video file
 * @param outputPath Path where the thumbnail should be saved
 * @param seekTime Time in seconds to capture the thumbnail from
 */
export async function generateThumbnail(
  videoPath: string,
  outputPath: string,
  seekTime: number = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(seekTime)
      .frames(1)
      .size('320x?') // 320px width, maintain aspect ratio
      .output(outputPath)
      .on('end', () => {
        resolve(outputPath)
      })
      .on('error', (err) => {
        reject(new Error(`Thumbnail generation failed: ${err.message}`))
      })
      .run()
  })
}
