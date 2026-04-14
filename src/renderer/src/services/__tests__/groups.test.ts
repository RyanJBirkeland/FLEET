import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listGroups, getGroupTasks, addTask, queueAll } from '../groups'

describe('groups service', () => {
  beforeEach(() => {
    const api = window.api.groups as unknown as Record<string, ReturnType<typeof vi.fn>>
    api.list.mockResolvedValue([])
    api.getGroupTasks.mockResolvedValue([])
    api.create.mockResolvedValue({})
    api.update.mockResolvedValue({})
    api.delete.mockResolvedValue(undefined)
    api.addTask.mockResolvedValue(true)
    api.removeTask.mockResolvedValue(true)
    api.queueAll.mockResolvedValue(0)
    api.reorderTasks.mockResolvedValue(undefined)
    api.addDependency.mockResolvedValue({})
    api.removeDependency.mockResolvedValue({})
    api.updateDependencyCondition.mockResolvedValue({})
  })

  it('listGroups delegates to window.api.groups.list', async () => {
    await listGroups()
    expect(window.api.groups.list).toHaveBeenCalled()
  })

  it('getGroupTasks passes groupId', async () => {
    await getGroupTasks('group-1')
    expect(window.api.groups.getGroupTasks).toHaveBeenCalledWith('group-1')
  })

  it('addTask passes taskId and groupId', async () => {
    await addTask('task-1', 'group-1')
    expect(window.api.groups.addTask).toHaveBeenCalledWith('task-1', 'group-1')
  })

  it('queueAll passes groupId', async () => {
    await queueAll('group-1')
    expect(window.api.groups.queueAll).toHaveBeenCalledWith('group-1')
  })
})
