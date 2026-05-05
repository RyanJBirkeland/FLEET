import { describe, it, expect, beforeEach } from 'vitest'
import { getMonacoV2Theme, V2_THEME_DARK, V2_THEME_LIGHT } from '../monaco-theme-v2'

beforeEach(() => {
  document.documentElement.style.setProperty('--bg', '#101012')
  document.documentElement.style.setProperty('--surf-1', '#161618')
  document.documentElement.style.setProperty('--surf-2', '#1c1c1f')
  document.documentElement.style.setProperty('--fg-3', '#7c7c85')
  document.documentElement.style.setProperty('--fg-4', '#525258')
  document.documentElement.style.setProperty('--accent-soft', 'rgba(255, 255, 255, 0.06)')
})

describe('monaco-theme-v2', () => {
  it('exposes stable theme name constants', () => {
    expect(V2_THEME_DARK).toBe('fleet-v2-dark')
    expect(V2_THEME_LIGHT).toBe('fleet-v2-light')
  })

  it('inherits from vs-dark when isDark is true', () => {
    const theme = getMonacoV2Theme(true)
    expect(theme.base).toBe('vs-dark')
    expect(theme.inherit).toBe(true)
  })

  it('inherits from vs when isDark is false', () => {
    const theme = getMonacoV2Theme(false)
    expect(theme.base).toBe('vs')
  })

  it('emits no syntax rules — chrome only', () => {
    const theme = getMonacoV2Theme(true)
    expect(theme.rules).toEqual([])
  })

  it('maps the V2 token values onto Monaco chrome colors', () => {
    const theme = getMonacoV2Theme(true)
    expect(theme.colors['editor.background']).toBe('#101012')
    expect(theme.colors['editorGutter.background']).toBe('#161618')
    expect(theme.colors['editor.lineHighlightBackground']).toBe('#1c1c1f')
    expect(theme.colors['editorLineNumber.foreground']).toBe('#525258')
    expect(theme.colors['editorLineNumber.activeForeground']).toBe('#7c7c85')
  })

  it('coerces rgba() token values to #RRGGBBAA hex', () => {
    const theme = getMonacoV2Theme(true)
    expect(theme.colors['editor.selectionBackground']).toBe('#ffffff0f')
    expect(theme.colors['editor.inactiveSelectionBackground']).toBe('#ffffff0f')
  })
})
