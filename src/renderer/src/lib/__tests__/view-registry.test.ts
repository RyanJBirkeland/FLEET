import { describe, it, expect } from 'vitest'
import { VIEW_REGISTRY } from '../view-registry'

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
})
