import type { ISpecValidator } from '../../../../shared/spec-quality/interfaces'
import type { ParsedSpec, SpecIssue } from '../../../../shared/spec-quality/types'

const BANNED_PHRASES = [
  'research',
  'investigate',
  'explore',
  'decide',
  'choose',
  'consider',
  'determine',
  'figure out',
  'think about',
  'evaluate',
  'analyze',
  'assess',
]

export class BannedPhrasesValidator implements ISpecValidator {
  validate(spec: ParsedSpec): SpecIssue[] {
    const section = spec.sections.find(
      s => s.heading.replace(/^#{2,3}\s+/, '').toLowerCase() === 'implementation steps'
    )

    // If section is missing, RequiredSectionsValidator handles the error
    if (section === undefined) return []

    const issues: SpecIssue[] = []
    const lines = section.content.split('\n')

    for (const line of lines) {
      const lower = line.toLowerCase()
      for (const phrase of BANNED_PHRASES) {
        if (lower.includes(phrase)) {
          issues.push({
            code: 'STEPS_BANNED_PHRASE',
            severity: 'warning',
            message: `Step contains vague/exploratory language: "${phrase}" — use explicit instructions instead`,
            location: line.trim(),
          })
          break // one warning per line
        }
      }
    }

    return issues
  }
}
