import type { ISpecValidator } from '../../../../shared/spec-quality/interfaces'
import type { ParsedSpec, SpecIssue } from '../../../../shared/spec-quality/types'

const REQUIRED_SECTIONS: Array<{ match: string; code: SpecIssue['code'] }> = [
  { match: 'overview', code: 'MISSING_SECTION_OVERVIEW' },
  { match: 'files to change', code: 'MISSING_SECTION_FILES_TO_CHANGE' },
  { match: 'implementation steps', code: 'MISSING_SECTION_IMPLEMENTATION_STEPS' },
  { match: 'how to test', code: 'MISSING_SECTION_HOW_TO_TEST' },
]

export class RequiredSectionsValidator implements ISpecValidator {
  validate(spec: ParsedSpec): SpecIssue[] {
    const issues: SpecIssue[] = []

    for (const { match, code } of REQUIRED_SECTIONS) {
      const found = spec.sections.some(s =>
        s.heading.replace(/^#{2,3}\s+/, '').toLowerCase() === match
      )
      if (!found) {
        issues.push({
          code,
          severity: 'error',
          message: `Missing required section: "## ${match.replace(/\b\w/g, c => c.toUpperCase())}"`,
        })
      }
    }

    return issues
  }
}
