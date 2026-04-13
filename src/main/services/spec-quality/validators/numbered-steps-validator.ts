import type { ISpecValidator } from '../../../../shared/spec-quality/interfaces'
import type { ParsedSpec, SpecIssue } from '../../../../shared/spec-quality/types'

const NUMBERED_LINE = /^\d+\./

export class NumberedStepsValidator implements ISpecValidator {
  validate(spec: ParsedSpec): SpecIssue[] {
    const section = spec.sections.find(
      s => s.heading.replace(/^#{2,3}\s+/, '').toLowerCase() === 'implementation steps'
    )

    // If section is missing, RequiredSectionsValidator handles the error
    if (section === undefined) return []

    const lines = section.content.split('\n')
    const hasNumbered = lines.some(line => NUMBERED_LINE.test(line.trim()))

    if (!hasNumbered) {
      return [
        {
          code: 'STEPS_NOT_NUMBERED',
          severity: 'error',
          message:
            'The "Implementation Steps" section exists but contains no numbered list items (expected lines starting with "1.", "2.", etc.)',
        },
      ]
    }

    return []
  }
}
