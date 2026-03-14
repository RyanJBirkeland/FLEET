import { readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

const REPO_PATHS: Record<string, string> = {
  'life-os': join(homedir(), 'Documents', 'Repositories', 'life-os'),
  feast: join(homedir(), 'Documents', 'Repositories', 'feast')
}

export function getRepoPaths(): Record<string, string> {
  return { ...REPO_PATHS }
}

export async function readSprintMd(repoPath: string): Promise<string> {
  const filePath = join(repoPath, 'SPRINT.md')
  return readFile(filePath, 'utf-8')
}
