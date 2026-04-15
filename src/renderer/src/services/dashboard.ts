export async function getCompletionsPerHour(): Promise<
  Awaited<ReturnType<NonNullable<typeof window.api.dashboard>['completionsPerHour']>> | undefined
> {
  return window.api.dashboard?.completionsPerHour()
}

export async function getRecentEvents(count: number): Promise<
  Awaited<ReturnType<NonNullable<typeof window.api.dashboard>['recentEvents']>> | undefined
> {
  return window.api.dashboard?.recentEvents(count)
}

export async function getPrList(): ReturnType<typeof window.api.pr.getList> {
  return window.api.pr.getList()
}

export async function getDailySuccessRate(days: number): Promise<
  Awaited<ReturnType<NonNullable<typeof window.api.dashboard>['dailySuccessRate']>> | undefined
> {
  return window.api.dashboard?.dailySuccessRate(days)
}

export async function getLoadAverage(): Promise<
  Awaited<ReturnType<NonNullable<typeof window.api.system>['loadAverage']>> | undefined
> {
  return window.api.system?.loadAverage()
}
