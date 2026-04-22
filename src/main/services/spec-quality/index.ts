/**
 * Public API for the spec-quality service module.
 *
 * Centralises both the service factory and the validateTaskSpec helper so that
 * callers outside the handler layer can import from the service layer directly,
 * keeping the dependency direction correct (services must not import from handlers).
 */

export { createSpecQualityService } from './factory'

import { createSpecQualityService } from './factory'
import { validateStructural } from '../../../shared/spec-validation'

const specQualityService = createSpecQualityService()

/**
 * Run structural and semantic validation on a task spec.
 * Throws an error with an appropriate message if validation fails.
 */
export async function validateTaskSpec(input: {
  title: string
  repo: string
  spec: string | null
  context: 'queue' | 'unblock'
}): Promise<void> {
  const prefix = input.context === 'queue' ? 'Cannot queue task' : 'Cannot unblock task'

  const structural = validateStructural({
    title: input.title,
    repo: input.repo,
    spec: input.spec
  })
  if (!structural.valid) {
    throw new Error(`${prefix} — spec quality checks failed: ${structural.errors.join('; ')}`)
  }

  // Full quality check (structural + AI prescriptiveness)
  if (input.spec) {
    const result = await specQualityService.validateFull(input.spec)
    if (!result.valid) {
      const firstError = result.errors[0]?.message ?? 'Spec did not pass quality checks'
      throw new Error(`${prefix} — semantic checks failed: ${firstError}`)
    }
  }
}
