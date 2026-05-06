export async function importPlan(
  repo: string
): ReturnType<typeof window.api.planner.import> {
  return window.api.planner.import(repo)
}
