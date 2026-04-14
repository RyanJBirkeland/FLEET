import type { AutoReviewRule } from '../../shared/types/task-types'
import { execFileAsync } from '../lib/async-utils'
import { buildAgentEnv } from '../env-utils'

export interface AutoMergeDecision {
  shouldMerge: true
  ruleName: string
}

export interface AutoMergeSkip {
  shouldMerge: false
}

export type AutoMergePolicyResult = AutoMergeDecision | AutoMergeSkip

async function getDiffFileStats(
  worktreePath: string
): Promise<Array<{ path: string; additions: number; deletions: number }> | null> {
  const env = buildAgentEnv()
  const { stdout: numstatOut } = await execFileAsync(
    'git',
    ['diff', '--numstat', 'origin/main...HEAD'],
    { cwd: worktreePath, env }
  )

  if (!numstatOut.trim()) {
    return null
  }

  return numstatOut
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t')
      const additions = parts[0] === '-' ? 0 : parseInt(parts[0], 10)
      const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10)
      const filePath = parts.slice(2).join('\t')
      return { path: filePath, additions, deletions }
    })
}

export async function evaluateAutoMergePolicy(
  rules: AutoReviewRule[],
  worktreePath: string
): Promise<AutoMergePolicyResult> {
  if (rules.length === 0) {
    return { shouldMerge: false }
  }

  const files = await getDiffFileStats(worktreePath)
  if (!files) {
    return { shouldMerge: false }
  }

  const { evaluateAutoReviewRules } = await import('../services/auto-review')
  const result = evaluateAutoReviewRules(rules, files)

  if (result && result.action === 'auto-merge') {
    return { shouldMerge: true, ruleName: result.rule.name }
  }

  return { shouldMerge: false }
}
