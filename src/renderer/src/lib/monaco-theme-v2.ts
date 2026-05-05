import type { editor } from 'monaco-editor'

/**
 * Build a Monaco V2 chrome-only theme — gutter, selection, current-line,
 * editor background — using the live values of the V2 design tokens
 * (`--bg`, `--surf-1/2`, `--fg-3/4`, `--accent-soft`).
 *
 * Why "chrome-only": syntax token colors stay as the existing fleet-light /
 * fleet-dark themes define them. We layer this on top with `inherit: true`
 * and an empty `rules` array so syntax stays untouched while chrome adopts
 * the V2 graphite palette.
 *
 * Must run after the DOM is mounted — relies on `getComputedStyle`.
 */
export function getMonacoV2Theme(isDark: boolean): editor.IStandaloneThemeData {
  const style = getComputedStyle(document.documentElement)
  const tokenHex = (name: string): string => toMonacoHex(style.getPropertyValue(name).trim())

  return {
    base: isDark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': tokenHex('--bg'),
      'editorGutter.background': tokenHex('--surf-1'),
      'editorLineNumber.foreground': tokenHex('--fg-4'),
      'editorLineNumber.activeForeground': tokenHex('--fg-3'),
      'editor.lineHighlightBackground': tokenHex('--surf-2'),
      'editor.selectionBackground': tokenHex('--accent-soft'),
      'editor.inactiveSelectionBackground': tokenHex('--accent-soft')
    }
  }
}

/**
 * Monaco color values must be `#RRGGBB` or `#RRGGBBAA` hex strings.
 * Token values arrive as either pure hex (`#101012`) or `rgba(…)` (e.g.
 * `--accent-soft`). Both must be coerced to Monaco's accepted format.
 */
function toMonacoHex(value: string): string {
  if (!value) return '#00000000'
  if (value.startsWith('#')) return value
  return rgbStringToHex(value)
}

/**
 * Converts a CSS `rgb(…)` / `rgba(…)` value to `#RRGGBB[AA]`.
 * Falls back to fully transparent black when the input is unparseable —
 * Monaco then renders the underlying base theme color, which is the
 * least-bad failure mode for chrome.
 */
function rgbStringToHex(value: string): string {
  const match = value.match(/rgba?\(([^)]+)\)/i)
  if (!match || !match[1]) return '#00000000'
  const parts = match[1].split(',').map((p) => p.trim())
  const [rRaw, gRaw, bRaw, aRaw] = parts
  const r = clampByte(rRaw)
  const g = clampByte(gRaw)
  const b = clampByte(bRaw)
  const baseHex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
  if (aRaw === undefined) return baseHex
  const alphaByte = Math.round(clampUnit(aRaw) * 255)
  return `${baseHex}${toHexByte(alphaByte)}`
}

function clampByte(raw: string | undefined): number {
  const n = Number(raw ?? 0)
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(255, Math.round(n)))
}

function clampUnit(raw: string): number {
  const n = Number(raw)
  if (Number.isNaN(n)) return 1
  return Math.max(0, Math.min(1, n))
}

function toHexByte(n: number): string {
  return n.toString(16).padStart(2, '0')
}

export const V2_THEME_DARK = 'fleet-v2-dark'
export const V2_THEME_LIGHT = 'fleet-v2-light'
