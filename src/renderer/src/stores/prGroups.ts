import { create } from 'zustand'
import type { PrGroup, SprintTask } from '../../../shared/types/task-types'

interface PrGroupsState {
  groups: PrGroup[]
  buildingGroupIds: Set<string>
  error: string | null

  loadGroups(repo?: string): Promise<void>
  createGroup(repo: string, title: string, branchName: string, description?: string): Promise<PrGroup>
  updateGroup(id: string, updates: { title?: string; branchName?: string; description?: string }): Promise<void>
  addTask(groupId: string, taskId: string): Promise<void>
  removeTask(groupId: string, taskId: string): Promise<void>
  buildGroup(id: string): Promise<{ success: boolean; prUrl?: string; error?: string; conflictingFiles?: string[] | undefined }>
  deleteGroup(id: string): Promise<void>
}

export const usePrGroupsStore = create<PrGroupsState>((set, get) => ({
  groups: [],
  buildingGroupIds: new Set(),
  error: null,

  async loadGroups(repo?: string) {
    try {
      const groups = await window.api.prGroups.list({ repo })
      set({ groups, error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load PR groups' })
    }
  },

  async createGroup(repo, title, branchName, description) {
    const group = await window.api.prGroups.create({ repo, title, branchName, description })
    set((s) => ({ groups: [group, ...s.groups] }))
    return group
  },

  async updateGroup(id, updates) {
    const updated = await window.api.prGroups.update({ id, ...updates })
    set((s) => ({ groups: s.groups.map((g) => (g.id === id ? updated : g)) }))
  },

  async addTask(groupId, taskId) {
    const updated = await window.api.prGroups.addTask({ groupId, taskId })
    set((s) => ({ groups: s.groups.map((g) => (g.id === groupId ? updated : g)) }))
  },

  async removeTask(groupId, taskId) {
    const updated = await window.api.prGroups.removeTask({ groupId, taskId })
    set((s) => ({ groups: s.groups.map((g) => (g.id === groupId ? updated : g)) }))
  },

  async buildGroup(id) {
    set((s) => ({ buildingGroupIds: new Set([...s.buildingGroupIds, id]) }))
    try {
      const result = await window.api.prGroups.build({ id })
      if (result.success) {
        await get().loadGroups()
      }
      return result.success
        ? { success: true, prUrl: result.prUrl }
        : { success: false, error: result.error, conflictingFiles: result.conflictingFiles }
    } finally {
      set((s) => {
        const next = new Set(s.buildingGroupIds)
        next.delete(id)
        return { buildingGroupIds: next }
      })
    }
  },

  async deleteGroup(id) {
    await window.api.prGroups.delete({ id })
    set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }))
  },
}))

export function selectUnassignedApprovedTasks(tasks: SprintTask[], groups: PrGroup[], repo: string): SprintTask[] {
  const assignedTaskIds = new Set(groups.flatMap((g) => g.task_order))
  return tasks.filter((t) => t.status === 'approved' && t.repo === repo && !assignedTaskIds.has(t.id))
}

export function selectGroupsForRepo(groups: PrGroup[], repo: string): PrGroup[] {
  return groups.filter((g) => g.repo === repo)
}
