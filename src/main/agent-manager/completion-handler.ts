import { execFile } from 'child_process'
import { promisify } from 'util'
import { getActualBranch, removeWorktree } from './worktree-ops'

const execFileAsync = promisify(execFile)

export const MAX_RETRIES = 3
export const FAST_FAIL_THRESHOLD_MS = 30_000
export const MAX_FAST_FAILS = 3

export interface CompletionContext {
  taskId: string
  agentId: string
  repoPath: string
  worktreePath: string
  ghRepo: string
  exitCode: number
  worktreeBase: string
  retryCount?: number
  fastFailCount?: number
  durationMs?: number
  updateTask: (update: Record<string, unknown>) => Promise<void>
}

async function pushBranchAndOpenPr(
  ctx: CompletionContext,
  branch: string,
): Promise<{ prUrl: string | null; prNumber: number | null }> {
  await execFileAsync('git', ['push', '-u', 'origin', branch], {
    cwd: ctx.worktreePath,
  })

  try {
    const { stdout } = await execFileAsync(
      'gh',
      ['pr', 'create', '--repo', ctx.ghRepo, '--head', branch, '--fill'],
      { cwd: ctx.worktreePath },
    )
    const prUrl = stdout.trim()
    const match = prUrl.match(/\/pull\/(\d+)/)
    const prNumber = match ? Number(match[1]) : null
    return { prUrl, prNumber }
  } catch {
    return { prUrl: null, prNumber: null }
  }
}

async function handleSuccess(ctx: CompletionContext): Promise<void> {
  const branch = await getActualBranch(ctx.worktreePath)
  const { prUrl, prNumber } = await pushBranchAndOpenPr(ctx, branch)

  await ctx.updateTask({
    status: 'done',
    pr_url: prUrl,
    pr_number: prNumber,
    pr_status: 'open',
    completed_at: new Date().toISOString(),
  })
}

async function handleFailure(ctx: CompletionContext): Promise<void> {
  const retryCount = ctx.retryCount ?? 0
  const fastFailCount = ctx.fastFailCount ?? 0

  const isFastFail =
    ctx.durationMs !== undefined && ctx.durationMs < FAST_FAIL_THRESHOLD_MS

  if (isFastFail) {
    const newFastFailCount = fastFailCount + 1
    if (newFastFailCount >= MAX_FAST_FAILS) {
      await ctx.updateTask({
        status: 'error',
        retry_count: retryCount,
        fast_fail_count: newFastFailCount,
      })
    } else {
      await ctx.updateTask({
        status: 'queued',
        retry_count: retryCount,
        fast_fail_count: newFastFailCount,
        claimed_by: null,
        agent_run_id: null,
      })
    }
  } else {
    const newRetryCount = retryCount + 1
    if (newRetryCount >= MAX_RETRIES) {
      await ctx.updateTask({
        status: 'error',
        retry_count: newRetryCount,
        fast_fail_count: fastFailCount,
      })
    } else {
      await ctx.updateTask({
        status: 'queued',
        retry_count: newRetryCount,
        fast_fail_count: fastFailCount,
        claimed_by: null,
        agent_run_id: null,
      })
    }
  }
}

export async function handleAgentCompletion(
  ctx: CompletionContext,
): Promise<void> {
  try {
    if (ctx.exitCode === 0) {
      await handleSuccess(ctx)
    } else {
      await handleFailure(ctx)
    }
  } finally {
    try {
      await removeWorktree(ctx.repoPath, ctx.worktreePath)
    } catch {
      // Swallow cleanup errors — don't rethrow
    }
  }
}
