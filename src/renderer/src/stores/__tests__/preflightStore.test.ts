import { describe, it, expect, beforeEach } from 'vitest'
import { usePreflightStore } from '../preflightStore'

const warningA = {
  taskId: 'task-a',
  repoName: 'fleet',
  taskTitle: 'Task A',
  missing: [],
  missingEnvVars: []
}

const warningB = {
  taskId: 'task-b',
  repoName: 'fleet',
  taskTitle: 'Task B',
  missing: [],
  missingEnvVars: []
}

describe('usePreflightStore', () => {
  beforeEach(() => {
    usePreflightStore.setState({ queue: [] })
  })

  it('back-to-back enqueues dequeue in FIFO order', () => {
    const { enqueue, dequeue } = usePreflightStore.getState()
    enqueue(warningA)
    enqueue(warningB)
    expect(usePreflightStore.getState().queue).toEqual([warningA, warningB])

    dequeue()
    expect(usePreflightStore.getState().queue).toEqual([warningB])

    dequeue()
    expect(usePreflightStore.getState().queue).toEqual([])
  })

  it('dequeue on an empty queue is a no-op', () => {
    const { dequeue } = usePreflightStore.getState()
    expect(usePreflightStore.getState().queue).toEqual([])
    dequeue()
    expect(usePreflightStore.getState().queue).toEqual([])
  })
})
