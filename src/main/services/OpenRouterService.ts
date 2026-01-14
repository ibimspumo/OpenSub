import { EventEmitter } from 'events'
import { readFileSync } from 'fs'
import type { Subtitle, AnalysisResult, SubtitleChange, AnalysisProgress } from '../../shared/types'

interface OpenRouterConfig {
  apiKey: string
  model: string
}

interface CorrectedSubtitle {
  index: number
  text: string
  reason?: string
  changeType?: 'spelling' | 'grammar' | 'context' | 'punctuation' | 'name'
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message: string
  }
}

export class OpenRouterService extends EventEmitter {
  private apiKey: string
  private model: string
  private abortController: AbortController | null = null

  constructor(config: OpenRouterConfig) {
    super()
    this.apiKey = config.apiKey
    this.model = config.model
  }

  private emitProgress(progress: AnalysisProgress): void {
    this.emit('progress', progress)
  }

  async analyze(
    audioPath: string,
    subtitles: Subtitle[],
    language: string
  ): Promise<AnalysisResult> {
    try {
      // 1. Load audio as base64
      this.emitProgress({
        stage: 'uploading',
        percent: 10,
        message: 'Audio wird vorbereitet...'
      })
      const audioBase64 = await this.loadAudioAsBase64(audioPath)

      // 2. Build prompt
      const prompt = this.buildPrompt(subtitles, language)

      // 3. Call OpenRouter API
      this.emitProgress({
        stage: 'analyzing',
        percent: 30,
        message: 'KI analysiert Audio und Text...'
      })
      const response = await this.callOpenRouter(audioBase64, prompt)

      // 4. Parse response and generate diff
      this.emitProgress({
        stage: 'comparing',
        percent: 80,
        message: 'Änderungen werden ermittelt...'
      })
      const correctedSubtitles = this.parseResponse(response)
      const changes = this.generateDiff(subtitles, correctedSubtitles)

      this.emitProgress({
        stage: 'complete',
        percent: 100,
        message: 'Analyse abgeschlossen'
      })

      return {
        changes,
        summary: this.summarizeChanges(changes)
      }
    } catch (error) {
      this.emitProgress({
        stage: 'error',
        percent: 0,
        message: error instanceof Error ? error.message : 'Unbekannter Fehler'
      })
      throw error
    }
  }

  private async loadAudioAsBase64(audioPath: string): Promise<string> {
    const audioBuffer = readFileSync(audioPath)
    return audioBuffer.toString('base64')
  }

  private buildPrompt(subtitles: Subtitle[], language: string): string {
    const subtitleList = subtitles
      .map((s, i) => `[${i}] ${s.text}`)
      .join('\n')

    return `Du bist ein Experte für Untertitel-Korrektur. Ich gebe dir eine Audio-Aufnahme und die automatisch generierte Transkription.

DEINE AUFGABE:
1. Höre dir das Audio genau an und verstehe den Inhalt
2. Vergleiche mit der Transkription
3. Korrigiere NUR wenn nötig:
   - Rechtschreibfehler (changeType: "spelling")
   - Grammatikfehler (changeType: "grammar")
   - Falsch erkannte Wörter basierend auf Kontext (changeType: "context")
   - Namen und Fachbegriffe (changeType: "name")
   - Zeichensetzung (changeType: "punctuation")

WICHTIG:
- Gib NUR Untertitel zurück, die korrigiert werden müssen
- Behalte die Original-Formatierung (Zeilenumbrüche etc.) bei
- Wenn ein Untertitel korrekt ist, lass ihn weg

Sprache: ${language}

AKTUELLE TRANSKRIPTION:
${subtitleList}

ANTWORTE EXAKT IN DIESEM JSON-FORMAT (keine anderen Texte):
{
  "correctedSubtitles": [
    { "index": 0, "text": "korrigierter Text", "reason": "Kurze Erklärung", "changeType": "spelling" }
  ]
}`
  }

  private async callOpenRouter(audioBase64: string, prompt: string): Promise<OpenRouterResponse> {
    this.abortController = new AbortController()

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://opensub.app',
        'X-Title': 'OpenSub'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: audioBase64,
                  format: 'mp3'
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' }
      }),
      signal: this.abortController.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  private parseResponse(response: OpenRouterResponse): CorrectedSubtitle[] {
    if (response.error) {
      throw new Error(`API Error: ${response.error.message}`)
    }

    const content = response.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('Keine Antwort von der KI erhalten')
    }

    try {
      const parsed = JSON.parse(content)
      return parsed.correctedSubtitles || []
    } catch {
      throw new Error('Ungültiges JSON in der KI-Antwort')
    }
  }

  private generateDiff(
    originalSubtitles: Subtitle[],
    correctedSubtitles: CorrectedSubtitle[]
  ): SubtitleChange[] {
    const changes: SubtitleChange[] = []

    for (const correction of correctedSubtitles) {
      const original = originalSubtitles[correction.index]
      if (!original) continue

      // Only add if text actually changed
      if (original.text.trim() !== correction.text.trim()) {
        changes.push({
          subtitleId: original.id,
          subtitleIndex: correction.index,
          originalText: original.text,
          correctedText: correction.text,
          changeType: correction.changeType || 'context',
          confidence: 0.9,
          reason: correction.reason,
          status: 'pending'
        })
      }
    }

    return changes
  }

  private summarizeChanges(changes: SubtitleChange[]): AnalysisResult['summary'] {
    return {
      totalChanges: changes.length,
      spellingFixes: changes.filter(c => c.changeType === 'spelling').length,
      grammarFixes: changes.filter(c => c.changeType === 'grammar').length,
      contextFixes: changes.filter(c => c.changeType === 'context').length,
      punctuationFixes: changes.filter(c => c.changeType === 'punctuation').length,
      nameFixes: changes.filter(c => c.changeType === 'name').length
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}
