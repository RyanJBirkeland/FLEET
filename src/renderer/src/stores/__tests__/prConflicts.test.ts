import { describe, it, expect, beforeEach } from 'vitest'
import { usePrConflictsStore } from '../prConflicts'

const initialState = {
  conflictingTaskIds: new Set<string>(),
}

describe('prConflicts store', () => {
  beforeEach(() => {
    usePrConflictsStore.setState(initialState)
  })

  it('starts with empty conflictingTaskIds', () => {
    expect(usePrConflictsStore.getState().conflictingTaskIds.size).toBe(0)
  })

  it('setConflicts populates conflictingTaskIds', () => {
    usePrConflictsStore.getState().setConflicts(['task-1', 'task-2'])
    const ids = usePrConflictsStore.getState().conflictingTaskIds
    expect(ids.has('task-1')).toBe(true)
    expect(ids.has('task-2')).toBe(true)
    expect(ids.size).toBe(2)
  })

  it('setConflicts replaces previous set', () => {
    usePrConflictsStore.getState().setConflicts(['task-1', 'task-2'])
    usePrConflictsStore.getState().setConflicts(['task-3'])
    const ids = usePrConflictsStore.getState().conflictingTaskIds
    expect(ids.has('task-1')).toBe(false)
    expect(ids.has('task-3')).toBe(true)
    expect(ids.size).toBe(1)
  })

  it('setConflicts can clear all conflicts', () => {
    usePrConflictsStore.getState().setConflicts(['task-1'])
    usePrConflictsStore.getState().setConflicts([])
    expect(usePrConflictsStore.getState().conflictingTaskIds.size).toBe(0)
  })

  it('smart equality: returns same state reference when contents are identical', () => {
    usePrConflictsStore.getState().setConflicts(['task-1', 'task-2'])
    const stateBefore = usePrConflictsStore.getState()
    usePrConflictsStore.getState().setConflicts(['task-1', 'task-2'])
    const stateAfter = usePrConflictsStore.getState()
    // Same Set reference means no re-render was triggered
    expect(stateAfter.conflictingTaskIds).toBe(stateBefore.conflictingTaskIds)
  })

  it('smart equality: creates new Set when contents differ', () => {
    usePrConflictsStore.getState().setConflicts(['task-1'])
    const setRef = usePrConflictsStore.getState().conflictingTaskIds
    usePrConflictsStore.getState().setConflicts(['task-2'])
    expect(usePrConflictsStore.getState().conflictingTaskIds).not.toBe(setRef)
  })

  it('smart equality: different size triggers update', () => {
    usePrConflictsStore.getState().setConflicts(['task-1'])
    const setRef = usePrConflictsStore.getState().conflictingTaskIds
    usePrConflictsStore.getState().setConflicts(['task-1', 'task-2'])
    expect(usePrConflictsStore.getState().conflictingTaskIds).not.toBe(setRef)
  })
})
