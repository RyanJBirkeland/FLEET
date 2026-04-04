import { describe, it, expect, beforeEach } from 'vitest'
import { useSprintUI } from '../sprintUI'

describe('sprintUI quickCreate state', () => {
  beforeEach(() => {
    useSprintUI.setState({ quickCreateOpen: false })
  })

  it('defaults quickCreateOpen to false', () => {
    expect(useSprintUI.getState().quickCreateOpen).toBe(false)
  })

  it('toggles quickCreateOpen', () => {
    useSprintUI.getState().toggleQuickCreate()
    expect(useSprintUI.getState().quickCreateOpen).toBe(true)
    useSprintUI.getState().toggleQuickCreate()
    expect(useSprintUI.getState().quickCreateOpen).toBe(false)
  })

  it('setQuickCreateOpen sets explicit value', () => {
    useSprintUI.getState().setQuickCreateOpen(true)
    expect(useSprintUI.getState().quickCreateOpen).toBe(true)
    useSprintUI.getState().setQuickCreateOpen(false)
    expect(useSprintUI.getState().quickCreateOpen).toBe(false)
  })
})
