import type { ISpecValidator } from '../../../../shared/spec-quality/interfaces'
import type { ParsedSpec, SpecIssue } from '../../../../shared/spec-quality/types'

const WORD_LIMIT = 500
const MAX_FILES = 10
const MAX_STEPS = 15

const FILE_PATH_PATTERN = /(?:\/src\/|src\/|\.\w{2,4}$)/

function countFilePaths(content: string): number {
  return content
    .split('\n')
    .filter(line => {
      const trimmed = line.trim().replace(/^[-*]\s*/, '')
      return FILE_PATH_PATTERN.test(trimmed)
    }).length
}

const NUMBERED_LINE = /^\d+\./

function countNumberedSteps(content: string): number {
  return content.split('\n').filter(line => NUMBERED_LINE.test(line.trim())).length
}

export class SizeWarningsValidator implements ISpecValidator {
  validate(spec: ParsedSpec): SpecIssue[] {
    const issues: SpecIssue[] = []

    if (spec.wordCount > WORD_LIMIT) {
      issues.push({
        code: 'SPEC_TOO_LONG',
        severity: 'warning',
        message: `Spec is ~${spec.wordCount} words; target under ${WORD_LIMIT}`,
      })
    }

    const filesSection = spec.sections.find(
      s => s.heading.replace(/^#{2,3}\s+/, '').toLowerCase() === 'files to change'
    )
    if (filesSection !== undefined) {
      const fileCount = countFilePaths(filesSection.content)
      if (fileCount > MAX_FILES) {
        issues.push({
          code: 'TOO_MANY_FILES',
          severity: 'warning',
          message: `"Files to Change" lists ${fileCount} files; consider splitting into multiple tasks (limit: ${MAX_FILES})`,
        })
      }
    }

    const stepsSection = spec.sections.find(
      s => s.heading.replace(/^#{2,3}\s+/, '').toLowerCase() === 'implementation steps'
    )
    if (stepsSection !== undefined) {
      const stepCount = countNumberedSteps(stepsSection.content)
      if (stepCount > MAX_STEPS) {
        issues.push({
          code: 'TOO_MANY_STEPS',
          severity: 'warning',
          message: `"Implementation Steps" has ${stepCount} numbered steps; consider splitting into multiple tasks (limit: ${MAX_STEPS})`,
        })
      }
    }

    return issues
  }
}
