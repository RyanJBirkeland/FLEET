import { describe, it, expect } from 'vitest'
import { TaskStatusSchema } from './schemas'
import { TASK_STATUSES } from '../../shared/task-state-machine'

describe('TaskStatusSchema', () => {
  it('accepts every declared task status literal', () => {
    for (const status of TASK_STATUSES) {
      expect(() => TaskStatusSchema.parse(status)).not.toThrow()
    }
  })

  it('rejects values not in the 9-literal union', () => {
    expect(() => TaskStatusSchema.parse('bogus')).toThrow()
    expect(() => TaskStatusSchema.parse('')).toThrow()
    expect(() => TaskStatusSchema.parse('QUEUED')).toThrow()
  })
})
