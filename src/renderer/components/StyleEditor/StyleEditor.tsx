import { useProjectStore } from '../../store/projectStore'
import type { AnimationType, SubtitlePosition } from '../../../shared/types'

export default function StyleEditor() {
  const { project, updateStyle } = useProjectStore()

  if (!project) return null

  const { style } = project

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-dark-200">Stil bearbeiten</h2>

      {/* Font Settings */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-dark-400 mb-1">Schriftart</label>
          <select
            value={style.fontFamily}
            onChange={(e) => updateStyle({ fontFamily: e.target.value })}
            className="w-full bg-dark-700 rounded px-3 py-2 text-sm"
          >
            <option value="Inter, system-ui, sans-serif">Inter</option>
            <option value="SF Pro Display, system-ui, sans-serif">SF Pro</option>
            <option value="Helvetica Neue, Helvetica, sans-serif">Helvetica</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="monospace">Monospace</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-dark-400 mb-1">
              Größe: {style.fontSize}px
            </label>
            <input
              type="range"
              min="24"
              max="96"
              value={style.fontSize}
              onChange={(e) => updateStyle({ fontSize: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Gewicht</label>
            <select
              value={style.fontWeight}
              onChange={(e) =>
                updateStyle({ fontWeight: e.target.value as 'normal' | 'bold' })
              }
              className="w-full bg-dark-700 rounded px-3 py-2 text-sm"
            >
              <option value="normal">Normal</option>
              <option value="bold">Fett</option>
            </select>
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Textfarbe</label>
            <input
              type="color"
              value={style.color}
              onChange={(e) => updateStyle({ color: e.target.value })}
              className="w-full h-10 bg-dark-700 rounded cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">Highlight</label>
            <input
              type="color"
              value={style.highlightColor}
              onChange={(e) => updateStyle({ highlightColor: e.target.value })}
              className="w-full h-10 bg-dark-700 rounded cursor-pointer"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-dark-400 mb-1">Umriss</label>
            <input
              type="color"
              value={style.outlineColor}
              onChange={(e) => updateStyle({ outlineColor: e.target.value })}
              className="w-full h-10 bg-dark-700 rounded cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs text-dark-400 mb-1">
              Umriss-Breite: {style.outlineWidth}
            </label>
            <input
              type="range"
              min="0"
              max="6"
              value={style.outlineWidth}
              onChange={(e) => updateStyle({ outlineWidth: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Position */}
      <div>
        <label className="block text-xs text-dark-400 mb-1">Position</label>
        <div className="flex gap-2">
          {(['top', 'center', 'bottom'] as SubtitlePosition[]).map((pos) => (
            <button
              key={pos}
              onClick={() => updateStyle({ position: pos })}
              className={`
                flex-1 py-2 rounded text-sm capitalize transition-colors
                ${
                  style.position === pos
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                }
              `}
            >
              {pos === 'top' ? 'Oben' : pos === 'center' ? 'Mitte' : 'Unten'}
            </button>
          ))}
        </div>
      </div>

      {/* Animation */}
      <div>
        <label className="block text-xs text-dark-400 mb-1">Animation</label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'karaoke', label: 'Karaoke' },
              { value: 'appear', label: 'Erscheinen' },
              { value: 'fade', label: 'Einblenden' },
              { value: 'scale', label: 'Skalieren' },
              { value: 'none', label: 'Keine' }
            ] as { value: AnimationType; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => updateStyle({ animation: value })}
              className={`
                py-2 rounded text-sm transition-colors
                ${
                  style.animation === value
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Shadow */}
      <div>
        <label className="block text-xs text-dark-400 mb-1">
          Schatten-Stärke: {style.shadowBlur}
        </label>
        <input
          type="range"
          min="0"
          max="20"
          value={style.shadowBlur}
          onChange={(e) => updateStyle({ shadowBlur: parseInt(e.target.value) })}
          className="w-full"
        />
      </div>
    </div>
  )
}
