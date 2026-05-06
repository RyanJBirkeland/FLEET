import { describe, it, expect } from 'vitest'
import { sanitizeCssColor } from '../PlEpicRail'

describe('sanitizeCssColor', () => {
  it('passes through a valid #RRGGBB hex color', () => {
    expect(sanitizeCssColor('#1a2b3c')).toBe('#1a2b3c')
  })

  it('passes through a valid #RGB shorthand hex color', () => {
    expect(sanitizeCssColor('#abc')).toBe('#abc')
  })

  it('rejects a 5-digit hex and returns the fallback', () => {
    expect(sanitizeCssColor('#12345')).toBe('var(--accent)')
  })

  it('returns the fallback for an empty string', () => {
    expect(sanitizeCssColor('')).toBe('var(--accent)')
  })

  it('returns the fallback for a javascript: URL injection attempt', () => {
    expect(sanitizeCssColor('javascript:alert(1)')).toBe('var(--accent)')
  })

  it('passes through a CSS named color', () => {
    expect(sanitizeCssColor('red')).toBe('red')
  })

  it('returns the fallback for null', () => {
    expect(sanitizeCssColor(null)).toBe('var(--accent)')
  })

  it('returns the fallback for undefined', () => {
    expect(sanitizeCssColor(undefined)).toBe('var(--accent)')
  })
})
