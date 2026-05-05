/**
 * Worktree lifecycle operations — add, remove, prune, and branch cleanup.
 *
 * All functions operate on the repo path (not the worktree path itself),
 * except removeWorktreeForce and cleanupWorktreeAndBranch which need both.
 */
import type { Logger } from '../logger'
import { execFileAsync } from '../lib/async-utils'
import { buildAgentEnv } from '../env-utils'

/** Hard timeout for git subprocess calls to prevent hangs in lifecycle operations. */
export const GIT_EXEC_TIMEOUT_MS = 30_000

/**
 * List all worktrees in porcelain format.
 * Returns stdout containing worktree metadata.
 */
export async function listWorktrees(repoPath: string, env: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoPath,
    env,
    timeout: GIT_EXEC_TIMEOUT_MS
  })
  return stdout
}

/**
 * Remove a worktree forcefully.
 */
export async function removeWorktreeForce(
  repoPath: string,
  worktreePath: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], {
    cwd: repoPath,
    env,
    timeout: GIT_EXEC_TIMEOUT_MS
  })
}

/**
 * Prune stale worktree administrative files.
 */
export async function pruneWorktrees(repoPath: string, env: NodeJS.ProcessEnv): Promise<void> {
  await execFileAsync('git', ['worktree', 'prune'], { cwd: repoPath, env, timeout: GIT_EXEC_TIMEOUT_MS })
}

/**
 * Delete a branch forcefully (git branch -D).
 */
export async function deleteBranch(
  repoPath: string,
  branch: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  await execFileAsync('git', ['branch', '-D', branch], { cwd: repoPath, env, timeout: GIT_EXEC_TIMEOUT_MS })
}

/**
 * Force delete a branch ref directly (bypasses worktree-in-use check).
 */
export async function forceDeleteBranchRef(
  repoPath: string,
  branch: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  await execFileAsync('git', ['update-ref', '-d', `refs/heads/${branch}`], {
    cwd: repoPath,
    env,
    timeout: GIT_EXEC_TIMEOUT_MS
  })
}

/**
 * Create a new worktree with a new branch.
 *
 * When `baseBranch` is provided the new branch starts at that commit instead
 * of the repo's current HEAD. Used by fork-on-approve to stack a downstream
 * agent on top of an approved parent's branch.
 */
export async function addWorktree(
  repoPath: string,
  branch: string,
  worktreePath: string,
  env: NodeJS.ProcessEnv,
  baseBranch?: string | undefined
): Promise<void> {
  const args = baseBranch
    ? ['worktree', 'add', '-b', branch, worktreePath, baseBranch]
    : ['worktree', 'add', '-b', branch, worktreePath]
  await execFileAsync('git', args, {
    cwd: repoPath,
    env,
    timeout: GIT_EXEC_TIMEOUT_MS
  })
}

/**
 * Clean up worktree and branch after merge or discard.
 * Best-effort cleanup — does not throw on failure.
 */
export async function cleanupWorktreeAndBranch(
  worktreePath: string,
  branch: string,
  repoPath: string,
  logger: Logger
): Promise<void> {
  const env = buildAgentEnv()
  try {
    await execFileAsync('git', ['worktree', 'remove', worktreePath, '--force'], {
      cwd: repoPath,
      env,
      timeout: GIT_EXEC_TIMEOUT_MS
    })
  } catch (err) {
    logger.warn(`[completion] Failed to remove worktree ${worktreePath}: ${err}`)
  }

  try {
    await execFileAsync('git', ['branch', '-D', branch], {
      cwd: repoPath,
      env,
      timeout: GIT_EXEC_TIMEOUT_MS
    })
  } catch (err) {
    logger.warn(`[completion] Failed to delete branch ${branch}: ${err}`)
  }
}
