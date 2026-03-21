import { execFile } from 'child_process'
import { mkdir, writeFile, unlink, access } from 'fs/promises'
import { createHash } from 'crypto'
import { promisify } from 'util'
import { join } from 'path'

const execFileAsync = promisify(execFile)

async function getDefaultBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', [
      'symbolic-ref',
      'refs/remotes/origin/HEAD',
      '--short',
    ], { cwd: repoPath })
    return stdout.trim()
  } catch {
    return 'main'
  }
}

function lockPath(repoPath: string, worktreeBase: string): string {
  const hash = createHash('md5').update(repoPath).digest('hex').slice(0, 8)
  return join(worktreeBase, `.lock-${hash}`)
}

export async function createWorktree(
  repoPath: string,
  taskId: string,
  worktreeBase: string,
  baseBranch?: string,
): Promise<{ worktreePath: string; branch: string }> {
  await mkdir(worktreeBase, { recursive: true })

  // Fetch from origin (offline is OK)
  try {
    await execFileAsync('git', ['fetch', 'origin'], { cwd: repoPath })
  } catch {
    // offline — continue
  }

  const base = baseBranch ?? await getDefaultBranch(repoPath)
  const branch = `agent/${taskId}`
  const worktreePath = join(worktreeBase, taskId)

  await execFileAsync('git', [
    'worktree',
    'add',
    '-b',
    branch,
    worktreePath,
    base,
  ], { cwd: repoPath })

  return { worktreePath, branch }
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
): Promise<void> {
  await execFileAsync('git', [
    'worktree',
    'remove',
    '--force',
    worktreePath,
  ], { cwd: repoPath })

  await execFileAsync('git', ['worktree', 'prune'], { cwd: repoPath })
}

export async function getActualBranch(worktreePath: string): Promise<string> {
  const { stdout } = await execFileAsync('git', [
    'rev-parse',
    '--abbrev-ref',
    'HEAD',
  ], { cwd: worktreePath })
  return stdout.trim()
}

export async function acquireRepoLock(
  repoPath: string,
  worktreeBase: string,
): Promise<void> {
  const lock = lockPath(repoPath, worktreeBase)
  const timeoutMs = 30_000
  const intervalMs = 500
  const start = Date.now()

  while (true) {
    try {
      await access(lock)
      // Lock file exists — someone else holds the lock
      if (Date.now() - start >= timeoutMs) {
        throw new Error(`Timeout acquiring repo lock for ${repoPath}`)
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    } catch (err) {
      if (err instanceof Error && err.message.includes('Timeout')) {
        throw err
      }
      // Lock file doesn't exist — acquire it
      await writeFile(lock, String(process.pid))
      return
    }
  }
}

export async function releaseRepoLock(
  repoPath: string,
  worktreeBase: string,
): Promise<void> {
  const lock = lockPath(repoPath, worktreeBase)
  await unlink(lock)
}
