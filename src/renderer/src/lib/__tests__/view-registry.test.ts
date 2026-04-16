import { describe, it, expect } from 'vitest'
import { VIEW_REGISTRY, VIEW_SHORTCUT_MAP } from '../view-registry'

describe('view-registry', () => {
  it('marks git view as hidden', () => {
    expect(VIEW_REGISTRY.git.hidden).toBe(true)
  })

  it('assigns ⌘6 shortcut to settings', () => {
    expect(VIEW_REGISTRY.settings.shortcut).toBe('⌘6')
    expect(VIEW_REGISTRY.settings.shortcutKey).toBe('6')
  })

  it('assigns ⌘7 shortcut to planner', () => {
    expect(VIEW_REGISTRY.planner.shortcut).toBe('⌘7')
    expect(VIEW_REGISTRY.planner.shortcutKey).toBe('7')
  })

  it('does not map hidden views to shortcuts', () => {
    expect(VIEW_SHORTCUT_MAP['6']).toBe('settings') // settings wins, not git
    expect(Object.values(VIEW_SHORTCUT_MAP)).not.toContain('git')
  })
})
