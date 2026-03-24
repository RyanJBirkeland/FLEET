import { execFile as execFileCb } from 'node:child_process'
import { promisify } from 'node:util'
import { updateTask } from '../data/sprint-queries'
import { buildAgentEnv } from '../env-utils'
import { MAX_RETRIES } from './types'
import type { Logger } from './types'

const execFile = promisify(execFileCb)

export interface ResolveSuccessOpts {
  taskId: string
  worktreePath: string
  title: string
  ghRepo: string
}

export interface ResolveFailureOpts {
  taskId: string
  retryCount: number
}

function parsePrOutput(stdout: string): { prUrl: string | null; prNumber: number | null } {
  // gh pr create outputs the PR URL as the last line, e.g.:
  // https://github.com/owner/repo/pull/42
  const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+\/pull\/(\d+)/)
  if (!urlMatch) return { prUrl: null, prNumber: null }
  return { prUrl: urlMatch[0], prNumber: parseInt(urlMatch[1], 10) }
}

export async function resolveSuccess(opts: ResolveSuccessOpts, logger: Logger): Promise<void> {
  const { taskId, worktreePath, title, ghRepo } = opts

  // 1. Detect current branch
  let branch: string
  try {
    const { stdout: branchOut } = await execFile(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: worktreePath, env: buildAgentEnv() }
    )
    branch = branchOut.trim()
  } catch (err) {
    logger.error(`[completion] Failed to detect branch for task ${taskId}: ${err}`)
    await updateTask(taskId, { status: 'error', completed_at: new Date().toISOString(), notes: 'Failed to detect branch' }).catch((e) =>
      logger.warn(`[completion] Failed to update task ${taskId} after branch detection error: ${e}`)
    )
    return
  }

  if (!branch) {
    logger.error(`[completion] Empty branch name for task ${taskId}`)
    await updateTask(taskId, { status: 'error', completed_at: new Date().toISOString(), notes: 'Empty branch name' }).catch((e) =>
      logger.warn(`[completion] Failed to update task ${taskId} after empty branch: ${e}`)
    )
    return
  }

  logger.info(`[completion] Task ${taskId}: pushing branch ${branch}`)

  // 2. Push branch to origin (skip pre-push hooks — agent code is reviewed via PR)
  try {
    await execFile('git', ['push', '--no-verify', 'origin', branch], { cwd: worktreePath, env: buildAgentEnv() })
  } catch (err) {
    logger.error(`[completion] git push failed for task ${taskId} (branch ${branch}): ${err}`)
    await updateTask(taskId, { notes: `git push failed for branch ${branch}: ${err}` }).catch((e) =>
      logger.warn(`[completion] Failed to update task ${taskId} after push error: ${e}`)
    )
    return
  }

  // 3. Open PR via gh CLI
  let prUrl: string | null = null
  let prNumber: number | null = null
  try {
    const { stdout: prOut } = await execFile(
      'gh',
      ['pr', 'create', '--title', title, '--body', 'Automated by BDE', '--head', branch, '--repo', ghRepo],
      { cwd: worktreePath, env: buildAgentEnv() }
    )
    const parsed = parsePrOutput(prOut)
    prUrl = parsed.prUrl
    prNumber = parsed.prNumber
  } catch (err) {
    logger.warn(`[completion] gh pr create failed for task ${taskId}: ${err}`)
    // User can create PR manually from the pushed branch — do not throw
  }

  // 4. Update task with PR info (task stays active; SprintPrPoller handles done on merge)
  try {
    if (prUrl !== null && prNumber !== null) {
      await updateTask(taskId, { pr_status: 'open', pr_url: prUrl, pr_number: prNumber })
    } else {
      // Push succeeded but PR creation failed — record branch name so user can create PR manually
      await updateTask(taskId, { notes: `Branch ${branch} pushed but PR creation failed` })
    }
  } catch (err) {
    logger.error(`[completion] Failed to update task ${taskId} with PR info: ${err}`)
  }
}

export async function resolveFailure(opts: ResolveFailureOpts, logger?: Logger): Promise<void> {
  const { taskId, retryCount } = opts

  try {
    if (retryCount < MAX_RETRIES) {
      await updateTask(taskId, {
        status: 'queued',
        retry_count: retryCount + 1,
        claimed_by: null,
      })
    } else {
      await updateTask(taskId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
    }
  } catch (err) {
    logger?.error(`[completion] Failed to update task ${taskId} during failure resolution: ${err}`)
  }
}
