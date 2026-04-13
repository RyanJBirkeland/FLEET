import type { ISpecValidator } from '../../../../shared/spec-quality/interfaces'
import type { ParsedSpec, SpecIssue } from '../../../../shared/spec-quality/types'

const FILE_PATH_PATTERN = /(?:\/src\/|^src\/|\.ts$|\.tsx$|\.css$|\.json$)/m

function hasFilePath(token: string): boolean {
  return (
    token.includes('/src/') ||
    token.startsWith('src/') ||
    token.endsWith('.ts') ||
    token.endsWith('.tsx') ||
    token.endsWith('.css') ||
    token.endsWith('.json')
  )
}

export class FilePathsValidator implements ISpecValidator {
  validate(spec: ParsedSpec): SpecIssue[] {
    const section = spec.sections.find(
      s => s.heading.replace(/^#{2,3}\s+/, '').toLowerCase() === 'files to change'
    )

    // If section is missing, RequiredSectionsValidator handles the error
    if (section === undefined) return []

    // Check if any token in the content looks like a file path
    const tokens = section.content.split(/\s+/)
    const hasAnyPath = tokens.some(hasFilePath) || FILE_PATH_PATTERN.test(section.content)

    if (!hasAnyPath) {
      return [
        {
          code: 'FILES_SECTION_NO_PATHS',
          severity: 'error',
          message:
            'The "Files to Change" section exists but contains no file paths (expected tokens with src/, .ts, .tsx, .css, or .json)',
        },
      ]
    }

    return []
  }
}
