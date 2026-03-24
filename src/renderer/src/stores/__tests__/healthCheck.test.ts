import { describe, it, expect, beforeEach } from 'vitest'
import { useHealthCheckStore } from '../healthCheck'

const initialState = {
  stuckTaskIds: new Set<string>(),
  dismissedIds: new Set<string>(),
}

describe('healthCheck store', () => {
  beforeEach(() => {
    useHealthCheckStore.setState(initialState)
  })

  it('starts with empty sets', () => {
    const state = useHealthCheckStore.getState()
    expect(state.stuckTaskIds.size).toBe(0)
    expect(state.dismissedIds.size).toBe(0)
  })

  it('setStuckTasks populates stuckTaskIds', () => {
    useHealthCheckStore.getState().setStuckTasks(['task-1', 'task-2'])
    const ids = useHealthCheckStore.getState().stuckTaskIds
    expect(ids.has('task-1')).toBe(true)
    expect(ids.has('task-2')).toBe(true)
    expect(ids.size).toBe(2)
  })

  it('setStuckTasks replaces previous set', () => {
    useHealthCheckStore.getState().setStuckTasks(['task-1', 'task-2'])
    useHealthCheckStore.getState().setStuckTasks(['task-3'])
    const ids = useHealthCheckStore.getState().stuckTaskIds
    expect(ids.has('task-1')).toBe(false)
    expect(ids.has('task-3')).toBe(true)
    expect(ids.size).toBe(1)
  })

  it('setStuckTasks is a no-op when contents are identical (returns same state reference)', () => {
    useHealthCheckStore.getState().setStuckTasks(['task-1'])
    const stateBefore = useHealthCheckStore.getState()
    useHealthCheckStore.getState().setStuckTasks(['task-1'])
    const stateAfter = useHealthCheckStore.getState()
    // Same Set reference means no re-render was triggered
    expect(stateAfter.stuckTaskIds).toBe(stateBefore.stuckTaskIds)
  })

  it('dismiss adds taskId to dismissedIds', () => {
    useHealthCheckStore.getState().dismiss('task-1')
    expect(useHealthCheckStore.getState().dismissedIds.has('task-1')).toBe(true)
  })

  it('dismiss accumulates multiple dismissals', () => {
    useHealthCheckStore.getState().dismiss('task-1')
    useHealthCheckStore.getState().dismiss('task-2')
    const ids = useHealthCheckStore.getState().dismissedIds
    expect(ids.has('task-1')).toBe(true)
    expect(ids.has('task-2')).toBe(true)
  })

  it('clearDismissed empties the dismissedIds set', () => {
    useHealthCheckStore.getState().dismiss('task-1')
    useHealthCheckStore.getState().dismiss('task-2')
    useHealthCheckStore.getState().clearDismissed()
    expect(useHealthCheckStore.getState().dismissedIds.size).toBe(0)
  })

  it('clearDismissed does not affect stuckTaskIds', () => {
    useHealthCheckStore.getState().setStuckTasks(['task-1'])
    useHealthCheckStore.getState().dismiss('task-1')
    useHealthCheckStore.getState().clearDismissed()
    expect(useHealthCheckStore.getState().stuckTaskIds.has('task-1')).toBe(true)
  })
})
