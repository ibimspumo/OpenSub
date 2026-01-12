import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import type { VideoMetadata, ExportOptions } from '../../shared/types'

// Set ffmpeg paths for macOS (Homebrew)
const ffmpegPath = '/opt/homebrew/bin/ffmpeg'
const ffprobePath = '/opt/homebrew/bin/ffprobe'
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

// Type for ffmpeg progress
interface FFmpegProgress {
  percent?: number
  currentFps?: number
  timemark?: string
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
   */
  async exportWithSubtitles(
    videoPath: string,
    subtitlePath: string,
    options: ExportOptions,
    onProgress?: (progress: { percent: number; fps: number; time: number }) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Build filter string for subtitle burning
      // Escape special characters in path
      const escapedSubPath = subtitlePath.replace(/[\\:]/g, '\\$&')
      const subtitleFilter = `subtitles='${escapedSubPath}'`

      // Build scale filter if needed
      const filters: string[] = []
      if (options.scale && options.scale !== 1) {
        filters.push(`scale=iw*${options.scale}:ih*${options.scale}`)
      }
      filters.push(subtitleFilter)

      // Quality settings
      const qualitySettings = {
        high: { crf: 18, preset: 'slow' },
        medium: { crf: 23, preset: 'medium' },
        low: { crf: 28, preset: 'fast' }
      }[options.quality]

      const command = ffmpeg(videoPath)
        .videoFilters(filters.join(','))
        .videoCodec('libx264')
        .addOptions([`-crf ${qualitySettings.crf}`, `-preset ${qualitySettings.preset}`])
        .audioCodec('aac')
        .audioBitrate('192k')
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
