import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLayoutPersister } from '../panel-persistence'
import * as settingsStorage from '../../services/settings-storage'
import type { PanelNode } from '../panel-tree'

const sampleLayout: PanelNode = {
  type: 'leaf',
  panelId: 'p1',
  tabs: [{ viewKey: 'dashboard', label: 'Dashboard' }],
  activeTab: 0
}

describe('createLayoutPersister', () => {
  let setSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    setSpy = vi.spyOn(settingsStorage, 'setJsonSetting').mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    setSpy.mockRestore()
  })

  it('flush with non-null layout calls saveLayout', () => {
    const persister = createLayoutPersister(500)
    persister.flush(sampleLayout)
    expect(setSpy).toHaveBeenCalledWith('panel.layout', sampleLayout)
  })

  it('flush with null layout does NOT call saveLayout', () => {
    const persister = createLayoutPersister(500)
    persister.flush(null)
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('cancel clears the pending debounce', () => {
    const persister = createLayoutPersister(500)
    persister.persist(sampleLayout)
    persister.cancel()
    vi.advanceTimersByTime(1000)
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('persist + advance timers triggers save (sanity check for cancel)', () => {
    const persister = createLayoutPersister(500)
    persister.persist(sampleLayout)
    vi.advanceTimersByTime(500)
    expect(setSpy).toHaveBeenCalledWith('panel.layout', sampleLayout)
  })
})
