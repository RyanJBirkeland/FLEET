/**
 * PR Group IPC handlers — CRUD operations and build orchestration for PR groups.
 *
 * PR groups let users batch approved tasks into a single stacked PR.
 * All mutations delegate to the data layer (pr-group-queries) or the
 * build service; handlers are thin wrappers with input validation only.
 */
import { safeHandle } from '../ipc-utils'
import { isValidTaskId } from '../lib/validation'
import {
  listPrGroups,
  createPrGroup,
  updatePrGroup,
  addTaskToGroup,
  removeTaskFromGroup,
  deletePrGroup,
} from '../data/pr-group-queries'
import type { PrGroupBuildService } from '../services/pr-group-build-service'

export interface PrGroupHandlersDeps {
  prGroupBuild: PrGroupBuildService
}

export function registerPrGroupHandlers(deps: PrGroupHandlersDeps): void {
  safeHandle('prGroups:list', async (_e, payload) => {
    return listPrGroups(payload.repo)
  })

  safeHandle('prGroups:create', async (_e, payload) => {
    const group = createPrGroup({
      repo: payload.repo,
      title: payload.title,
      branchName: payload.branchName,
      description: payload.description,
    })
    if (!group) throw new Error('Failed to create PR group')
    return group
  })

  safeHandle('prGroups:update', async (_e, payload) => {
    const { id, title, branchName, description } = payload
    const updated = updatePrGroup(id, { title, branchName, description })
    if (!updated) throw new Error(`PR group ${id} not found`)
    return updated
  })

  safeHandle('prGroups:addTask', async (_e, payload) => {
    if (!isValidTaskId(payload.taskId)) throw new Error('Invalid task ID format')
    const updated = addTaskToGroup(payload.groupId, payload.taskId)
    if (!updated) throw new Error(`PR group ${payload.groupId} not found`)
    return updated
  })

  safeHandle('prGroups:removeTask', async (_e, payload) => {
    const updated = removeTaskFromGroup(payload.groupId, payload.taskId)
    if (!updated) throw new Error(`PR group ${payload.groupId} not found`)
    return updated
  })

  safeHandle('prGroups:build', async (_e, payload) => {
    return deps.prGroupBuild.buildGroup(payload.id)
  })

  safeHandle('prGroups:delete', async (_e, payload) => {
    const deleted = deletePrGroup(payload.id)
    return { success: deleted }
  })
}
