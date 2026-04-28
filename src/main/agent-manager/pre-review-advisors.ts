/**
 * pre-review-advisors.ts — Pluggable advisory checks run before the review transition.
 *
 * Each PreReviewAdvisor produces a warning string (appended to task.notes)
 * or null when nothing to report. Errors are caught so a flaky check cannot
 * stall the success path.
 */

import type { IAgentTaskRepository } from '../data/sprint-task-repository'
import type { Logger } from '../logger'
import { buildAgentEnv } from '../env-utils'
import { execFileAsync } from '../lib/async-utils'
import { detectUntouchedTests, listChangedFiles, formatAdvisory } from './test-touch-check'
import { scanForUnverifiedFacts } from './unverified-facts-scanner'
import { appendAdvisoryNote } from './verification-gate'
import { GIT_EXEC_TIMEOUT_MS } from './worktree-lifecycle'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Context passed to each PreReviewAdvisor. Advisory checks read these fields
 * to produce their warnings; they never write to the repository directly.
 */
export interface PreReviewAdvisorContext {
  taskId: string
  branch: string
  worktreePath: string
  repoPath: string | undefined
  logger: Logger
}

/**
 * A pluggable advisory check run before the review transition.
 *
 * Returns a warning string (appended to task.notes) or null when nothing to
 * report. Errors are caught by the orchestrator so a flaky check cannot stall
 * the success path.
 */
export interface PreReviewAdvisor {
  name: string
  advise(ctx: PreReviewAdvisorContext): Promise<string | null>
}

const untouchedTestsAdvisor: PreReviewAdvisor = {
  name: 'untouchedTests',
  async advise(ctx) {
    const env = buildAgentEnv()
    const changedFiles = await listChangedFiles(ctx.branch, ctx.worktreePath, env, { logger: ctx.logger })
    if (changedFiles.length === 0) return null

    const testCheckRepoPath = ctx.repoPath ?? ctx.worktreePath
    const untouched = detectUntouchedTests(changedFiles, testCheckRepoPath, { logger: ctx.logger })
    if (untouched.length === 0) return null

    return formatAdvisory(untouched)
  }
}

const unverifiedFactsAdvisor: PreReviewAdvisor = {
  name: 'unverifiedFacts',
  async advise(ctx) {
    const env = buildAgentEnv()

    let diff: string
    try {
      const result = await execFileAsync('git', ['diff', 'HEAD~1', 'HEAD'], {
        cwd: ctx.worktreePath,
        env,
        timeout: GIT_EXEC_TIMEOUT_MS
      })
      diff = result.stdout
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('unknown revision') || message.includes('ambiguous argument')) {
        ctx.logger.info(
          '[pre-review-advisors] first-commit branch — unverified-facts advisory skipped'
        )
      } else {
        throw err
      }
      return null
    }

    const packageJsonPath = join(ctx.worktreePath, 'package.json')
    const packageJsonContent = await readFile(packageJsonPath, 'utf8').catch(() => '{}')

    const warnings = scanForUnverifiedFacts(diff, packageJsonContent)
    return warnings.length > 0 ? warnings.join('\n') : null
  }
}

/** Default set of pre-review advisors run before every review transition. */
export const DEFAULT_PRE_REVIEW_ADVISORS: readonly PreReviewAdvisor[] = [
  untouchedTestsAdvisor,
  unverifiedFactsAdvisor
]

/**
 * Runs each advisor in the supplied list. Non-null warnings are appended to
 * the task's notes. Errors in individual advisors are caught and logged so a
 * single flaky check cannot stall the success path.
 *
 * Pass `DEFAULT_PRE_REVIEW_ADVISORS` for the standard set, or a custom list
 * in tests to control which advisors run without mutating global state.
 */
export async function runPreReviewAdvisors(
  ctx: PreReviewAdvisorContext,
  repo: IAgentTaskRepository,
  advisors: readonly PreReviewAdvisor[] = DEFAULT_PRE_REVIEW_ADVISORS
): Promise<void> {
  for (const advisor of advisors) {
    try {
      const warning = await advisor.advise(ctx)
      if (warning) {
        appendAdvisoryNote(ctx.taskId, warning, repo, ctx.logger)
      }
    } catch (err) {
      ctx.logger.warn(
        `[completion] Advisory check "${advisor.name}" skipped for task ${ctx.taskId}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }
}
