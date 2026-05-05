/**
 * Synchronous spec validators — five independent structural checks.
 * Each validates one aspect of a parsed spec and returns any issues found.
 * Grouped here because they are small, stateless, and share the same interface.
 * PrescriptivenessValidator lives separately because it is async (SDK-dependent).
 */

import type { ISpecValidator } from '../../../../shared/spec-quality/interfaces'
import type { ParsedSpec, SpecIssue } from '../../../../shared/spec-quality/types'

// ---------------------------------------------------------------------------
// RequiredSectionsValidator
// ---------------------------------------------------------------------------

// Overview section accepts either "## Context" (preferred) or "## Overview" (backward-compatible).
const CONTEXT_OR_OVERVIEW = /^(context|overview)$/i

type SectionMatcher = string | RegExp

const REQUIRED_SECTIONS: Array<{ match: SectionMatcher; label: string; code: SpecIssue['code'] }> =
  [
    { match: CONTEXT_OR_OVERVIEW, label: 'Context', code: 'MISSING_SECTION_OVERVIEW' },
    { match: 'files to change', label: 'Files to Change', code: 'MISSING_SECTION_FILES_TO_CHANGE' },
    {
      match: 'implementation steps',
      label: 'Implementation Steps',
      code: 'MISSING_SECTION_IMPLEMENTATION_STEPS'
    },
    { match: 'how to test', label: 'How to Test', code: 'MISSING_SECTION_HOW_TO_TEST' }
  ]

function headingMatchesRule(normalizedHeading: string, rule: SectionMatcher): boolean {
  return rule instanceof RegExp ? rule.test(normalizedHeading) : normalizedHeading === rule
}

export class RequiredSectionsValidator implements ISpecValidator {
  validate(spec: ParsedSpec): SpecIssue[] {
    const issues: SpecIssue[] = []
    for (const { match, label, code } of REQUIRED_SECTIONS) {
      const found = spec.sections.some((s) =>
        headingMatchesRule(s.heading.replace(/^#{2,3}\s+/, '').toLowerCase(), match)
      )
      if (!found) {
        issues.push({
          code,
          severity: 'error',
          message: `Missing required section: "## ${label}"`
        })
      }
    }
    return issues
  }
}

// ---------------------------------------------------------------------------
// FilePathsValidator
// ---------------------------------------------------------------------------

// Matches any token that looks like a file path: contains a slash, or ends
// with an extension (word chars, dot, word chars). Language-agnostic so
// .java, .py, .go, .rb, etc. all qualify alongside TypeScript/CSS/JSON.
const FILE_PATH_PATTERN = /(?:\/|\.\w+$)/m

function hasFilePath(token: string): boolean {
  return token.includes('/') || /\.\w+$/.test(token)
}

export class FilePathsValidator implements ISpecValidator {
  validate(spec: ParsedSpec): SpecIssue[] {
    const section = spec.sections.find(
      (s) => s.heading.replace(/^#{2,3}\s+/, '').toLowerCase() === 'files to change'
    )
    if (section === undefined) return []

    const tokens = section.content.split(/\s+/)
    const hasAnyPath = tokens.some(hasFilePath) || FILE_PATH_PATTERN.test(section.content)

    if (!hasAnyPath) {
      return [
        {
          code: 'FILES_SECTION_NO_PATHS',
          severity: 'error',
          message:
            'The "Files to Change" section exists but contains no file paths (expected paths with a / or file extension like .ts, .java, .py, .go)'
        }
      ]
    }
    return []
  }
}

// ---------------------------------------------------------------------------
// NumberedStepsValidator
// ---------------------------------------------------------------------------

const NUMBERED_LINE = /^\d+\./

export class NumberedStepsValidator implements ISpecValidator {
  validate(spec: ParsedSpec): SpecIssue[] {
    const section = spec.sections.find(
      (s) => s.heading.replace(/^#{2,3}\s+/, '').toLowerCase() === 'implementation steps'
    )
    if (section === undefined) return []

    const lines = section.content.split('\n')
    const hasNumbered = lines.some((line) => NUMBERED_LINE.test(line.trim()))

    if (!hasNumbered) {
      return [
        {
          code: 'STEPS_NOT_NUMBERED',
          severity: 'error',
          message:
            'The "Implementation Steps" section exists but contains no numbered list items (expected lines starting with "1.", "2.", etc.)'
        }
      ]
    }
    return []
  }
}

// ---------------------------------------------------------------------------
// BannedPhrasesValidator
// ---------------------------------------------------------------------------

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
  'assess'
]

export class BannedPhrasesValidator implements ISpecValidator {
  validate(spec: ParsedSpec): SpecIssue[] {
    const section = spec.sections.find(
      (s) => s.heading.replace(/^#{2,3}\s+/, '').toLowerCase() === 'implementation steps'
    )
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
            location: line.trim()
          })
          break // one warning per line
        }
      }
    }
    return issues
  }
}

// ---------------------------------------------------------------------------
// SizeWarningsValidator
// ---------------------------------------------------------------------------

const WORD_LIMIT = 500
const MAX_FILES = 15
const MAX_STEPS = 15

const FILE_SIZE_PATTERN = /(?:\/src\/|src\/|\.\w{2,4}$)/

function countFilePaths(content: string): number {
  return content
    .split('\n')
    .filter((line) => FILE_SIZE_PATTERN.test(line.trim().replace(/^[-*]\s*/, ''))).length
}

function countNumberedSteps(content: string): number {
  return content.split('\n').filter((line) => NUMBERED_LINE.test(line.trim())).length
}

export class SizeWarningsValidator implements ISpecValidator {
  validate(spec: ParsedSpec): SpecIssue[] {
    const issues: SpecIssue[] = []

    if (spec.wordCount > WORD_LIMIT) {
      // Hard block at 1000 words — specs this long cause 100% agent timeout.
      // Advisory warning between 500–1000 words so users can still queue if they accept the risk.
      const isHardBlock = spec.wordCount > 1000
      issues.push({
        code: 'SPEC_TOO_LONG',
        severity: isHardBlock ? 'error' : 'warning',
        message: isHardBlock
          ? `Spec is ~${spec.wordCount} words — must be under 1000 (agents reliably time out above this limit)`
          : `Spec is ~${spec.wordCount} words; target under ${WORD_LIMIT} for best results`
      })
    }

    const filesSection = spec.sections.find(
      (s) => s.heading.replace(/^#{2,3}\s+/, '').toLowerCase() === 'files to change'
    )
    if (filesSection !== undefined) {
      const fileCount = countFilePaths(filesSection.content)
      if (fileCount > MAX_FILES) {
        issues.push({
          code: 'TOO_MANY_FILES',
          severity: 'warning',
          message: `"Files to Change" lists ${fileCount} files. For cross-cutting refactors this may be necessary; consider splitting into multiple tasks only if the changes are logically independent (limit: ${MAX_FILES}).`
        })
      }
    }

    const stepsSection = spec.sections.find(
      (s) => s.heading.replace(/^#{2,3}\s+/, '').toLowerCase() === 'implementation steps'
    )
    if (stepsSection !== undefined) {
      const stepCount = countNumberedSteps(stepsSection.content)
      if (stepCount > MAX_STEPS) {
        issues.push({
          code: 'TOO_MANY_STEPS',
          severity: 'warning',
          message: `"Implementation Steps" has ${stepCount} numbered steps; consider splitting into multiple tasks (limit: ${MAX_STEPS})`
        })
      }
    }

    return issues
  }
}
