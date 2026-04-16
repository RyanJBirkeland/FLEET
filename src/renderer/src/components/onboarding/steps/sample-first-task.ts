/**
 * Sample spec used by the "Create your first task" button on the onboarding
 * DoneStep. Follows the Feature template (see `SPEC_TEMPLATES` in SpecEditor)
 * so readiness checks pass. Target files are clearly marked as placeholders
 * the user should update.
 */
import type { SpecType } from '../../../../../shared/spec-validation'

export const SAMPLE_FIRST_TASK: {
  title: string
  repo: string
  spec: string
  specType: SpecType
} = {
  title: 'Add a README section describing how to run the project',
  repo: '',
  specType: 'feature',
  spec: `## Problem

New contributors to this repository don't have a clear "how to run this" reference in the README.

## Solution

Add a \`## Getting Started\` section to \`README.md\` that describes:

- Prerequisites (language runtime, package manager)
- How to install dependencies
- How to run the project locally
- How to run the tests

Keep it under 20 lines. Use code blocks for commands.

## Files to Change

- \`README.md\` — add the Getting Started section

## How to Test

- Read the section and verify the commands are accurate for this project.
- Run the documented commands yourself to confirm they work.

## Out of Scope

- Changing any source code.
- Adding documentation beyond the Getting Started section.
`
}
