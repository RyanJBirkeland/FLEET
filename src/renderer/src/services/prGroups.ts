export async function listPrGroups(
  payload: Parameters<typeof window.api.prGroups.list>[0]
): ReturnType<typeof window.api.prGroups.list> {
  return window.api.prGroups.list(payload)
}

export async function createPrGroup(
  payload: Parameters<typeof window.api.prGroups.create>[0]
): ReturnType<typeof window.api.prGroups.create> {
  return window.api.prGroups.create(payload)
}

export async function updatePrGroup(
  payload: Parameters<typeof window.api.prGroups.update>[0]
): ReturnType<typeof window.api.prGroups.update> {
  return window.api.prGroups.update(payload)
}

export async function addTaskToPrGroup(
  payload: Parameters<typeof window.api.prGroups.addTask>[0]
): ReturnType<typeof window.api.prGroups.addTask> {
  return window.api.prGroups.addTask(payload)
}

export async function removeTaskFromPrGroup(
  payload: Parameters<typeof window.api.prGroups.removeTask>[0]
): ReturnType<typeof window.api.prGroups.removeTask> {
  return window.api.prGroups.removeTask(payload)
}

export async function buildPrGroup(
  payload: Parameters<typeof window.api.prGroups.build>[0]
): ReturnType<typeof window.api.prGroups.build> {
  return window.api.prGroups.build(payload)
}

export async function deletePrGroup(
  payload: Parameters<typeof window.api.prGroups.delete>[0]
): ReturnType<typeof window.api.prGroups.delete> {
  return window.api.prGroups.delete(payload)
}
