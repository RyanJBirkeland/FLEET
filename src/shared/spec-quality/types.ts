export type IssueSeverity = 'error' | 'warning'

export type IssueCode =
  | 'MISSING_SECTION_OVERVIEW'
  | 'MISSING_SECTION_FILES_TO_CHANGE'
  | 'MISSING_SECTION_IMPLEMENTATION_STEPS'
  | 'MISSING_SECTION_HOW_TO_TEST'
  | 'FILES_SECTION_NO_PATHS'
  | 'STEPS_NOT_NUMBERED'
  | 'STEPS_BANNED_PHRASE'
  | 'TOO_MANY_FILES'
  | 'TOO_MANY_STEPS'
  | 'SPEC_TOO_LONG'
  | 'STEP_REQUIRES_DESIGN_DECISION'

export interface SpecIssue {
  code: IssueCode
  severity: IssueSeverity
  message: string
  /** Optional line number or section name for context */
  location?: string
}

export interface ParsedSpec {
  raw: string
  wordCount: number
  sections: ParsedSection[]
}

export interface ParsedSection {
  heading: string // e.g. "## Overview"
  level: number // 2 = ##, 3 = ###
  content: string // text under this heading until next same-or-higher heading
}

export interface SpecQualityResult {
  valid: boolean // true only if no errors (warnings are OK)
  issues: SpecIssue[] // all issues combined
  errors: SpecIssue[] // severity === 'error'
  warnings: SpecIssue[] // severity === 'warning'
  prescriptivenessChecked: boolean // true if async AI check ran
}
