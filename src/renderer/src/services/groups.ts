export async function listGroups() {
  return window.api.groups.list()
}

export async function getGroupTasks(groupId: string) {
  return window.api.groups.getGroupTasks(groupId)
}

export async function createGroup(input: Parameters<typeof window.api.groups.create>[0]) {
  return window.api.groups.create(input)
}

export async function updateGroup(
  id: string,
  patch: Parameters<typeof window.api.groups.update>[1]
) {
  return window.api.groups.update(id, patch)
}

export async function deleteGroup(id: string): Promise<void> {
  return window.api.groups.delete(id)
}

export async function addTask(taskId: string, groupId: string): Promise<boolean> {
  return window.api.groups.addTask(taskId, groupId)
}

export async function removeTask(taskId: string): Promise<boolean> {
  return window.api.groups.removeTask(taskId)
}

export async function queueAll(groupId: string): Promise<number> {
  return window.api.groups.queueAll(groupId)
}

export async function reorderTasks(groupId: string, orderedTaskIds: string[]): Promise<boolean> {
  return window.api.groups.reorderTasks(groupId, orderedTaskIds)
}

export async function addDependency(
  groupId: string,
  dep: Parameters<typeof window.api.groups.addDependency>[1]
) {
  return window.api.groups.addDependency(groupId, dep)
}

export async function removeDependency(groupId: string, upstreamId: string) {
  return window.api.groups.removeDependency(groupId, upstreamId)
}

export async function updateDependencyCondition(
  groupId: string,
  upstreamId: string,
  condition: Parameters<typeof window.api.groups.updateDependencyCondition>[2]
) {
  return window.api.groups.updateDependencyCondition(groupId, upstreamId, condition)
}
