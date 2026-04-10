/**
 * Shared validation helpers for sprint task handlers.
 * Extracted to reduce duplication across handlers.
 */

/**
 * Run structural and semantic validation on a task spec.
 * Throws an error with appropriate message if validation fails.
 */
export async function validateTaskSpec(input: {
  title: string
  repo: string
  spec: string | null
  context: 'queue' | 'unblock'
}): Promise<void> {
  const prefix = input.context === 'queue' ? 'Cannot queue task' : 'Cannot unblock task'

  // Structural check
  const { validateStructural } = await import('../../shared/spec-validation')
  const structural = validateStructural({
    title: input.title,
    repo: input.repo,
    spec: input.spec
  })
  if (!structural.valid) {
    throw new Error(`${prefix} — spec quality checks failed: ${structural.errors.join('; ')}`)
  }

  // Semantic check
  if (input.spec) {
    const { checkSpecSemantic } = await import('../spec-semantic-check')
    const semantic = await checkSpecSemantic({
      title: input.title,
      repo: input.repo,
      spec: input.spec
    })
    if (!semantic.passed) {
      throw new Error(`${prefix} — semantic checks failed: ${semantic.failMessages.join('; ')}`)
    }
  }
}
