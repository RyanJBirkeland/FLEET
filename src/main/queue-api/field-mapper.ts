const CAMEL_TO_SNAKE: Record<string, string> = {
  agentRunId: 'agent_run_id', prUrl: 'pr_url', prNumber: 'pr_number',
  prStatus: 'pr_status', prMergeableState: 'pr_mergeable_state',
  retryCount: 'retry_count', fastFailCount: 'fast_fail_count',
  repoPath: 'repo_path', ghRepo: 'gh_repo', dependsOn: 'depends_on',
  startedAt: 'started_at', completedAt: 'completed_at',
  createdAt: 'created_at', updatedAt: 'updated_at',
  claimedBy: 'claimed_by', templateName: 'template_name',
}

const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([c, s]) => [s, c])
)

export function toCamelCase<T extends object>(row: T): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    result[SNAKE_TO_CAMEL[key] ?? key] = value
  }
  return result
}

export function toSnakeCase<T extends object>(fields: T): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    result[CAMEL_TO_SNAKE[key] ?? key] = value
  }
  return result
}
