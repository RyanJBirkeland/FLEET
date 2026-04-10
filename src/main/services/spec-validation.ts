/**
 * Spec validation orchestration for sprint tasks.
 * Combines structural (synchronous) and semantic (async LLM-based) checks.
 * Extracted from sprint-local.ts to improve separation of concerns.
 */

import { validateStructural } from '../../shared/spec-validation'
import { checkSpecSemantic } from '../spec-semantic-check'

export interface ValidationInput {
  title: string
  repo: string
  spec: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Run both structural and semantic validation on a task spec.
 * Structural checks are fast (regex-based). Semantic checks use LLM.
 */
export async function validateSpecForQueue(input: ValidationInput): Promise<ValidationResult> {
  const errors: string[] = []

  // Structural validation (synchronous)
  const structural = validateStructural({
    title: input.title,
    repo: input.repo,
    spec: input.spec
  })

  if (!structural.valid) {
    errors.push(...structural.errors)
    return { valid: false, errors }
  }

  // Semantic validation (async, LLM-based)
  const semantic = await checkSpecSemantic({
    title: input.title,
    repo: input.repo,
    spec: input.spec
  })

  if (!semantic.passed) {
    errors.push(...semantic.failMessages)
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}
