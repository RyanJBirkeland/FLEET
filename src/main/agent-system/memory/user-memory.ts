import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { BDE_MEMORY_DIR } from '../../paths'
import { getSettingJson, setSettingJson } from '../../settings'

const SETTING_KEY = 'memory.activeFiles'

export interface UserMemoryResult {
  content: string
  totalBytes: number
  fileCount: number
}

/**
 * Reads all active user memory files and concatenates their contents.
 *
 * Active files are tracked in the `memory.activeFiles` setting as a
 * `Record<string, boolean>` where keys are relative paths within
 * `~/.bde/memory/`.
 *
 * Missing files are pruned from the setting automatically.
 *
 * @returns Concatenated content with `### {filename}` headers and `---` separators.
 */
export function getUserMemory(): UserMemoryResult {
  const activeFiles = getSettingJson<Record<string, boolean>>(SETTING_KEY)
  if (!activeFiles || Object.keys(activeFiles).length === 0) {
    return { content: '', totalBytes: 0, fileCount: 0 }
  }

  const sections: string[] = []
  let totalBytes = 0
  let pruned = false

  const remaining: Record<string, boolean> = {}

  for (const [relativePath, active] of Object.entries(activeFiles)) {
    if (!active) continue

    const fullPath = join(BDE_MEMORY_DIR, relativePath)
    if (!existsSync(fullPath)) {
      pruned = true
      continue
    }

    try {
      const content = readFileSync(fullPath, 'utf-8')
      sections.push(`### ${relativePath}\n\n${content}`)
      totalBytes += Buffer.byteLength(content, 'utf-8')
      remaining[relativePath] = true
    } catch {
      // File unreadable — prune it
      pruned = true
    }
  }

  if (pruned) {
    setSettingJson(SETTING_KEY, remaining)
  }

  return {
    content: sections.join('\n\n---\n\n'),
    totalBytes,
    fileCount: sections.length
  }
}
