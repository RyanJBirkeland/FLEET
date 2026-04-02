// src/renderer/src/lib/prompt-assembly.ts
//
// Pure utility functions for the Agent Launchpad feature.
// No React, no stores, no side effects — just data transformation.

import type { PromptTemplate } from './launchpad-types'

/**
 * Interpolates a PromptTemplate's promptTemplate string with user answers.
 *
 * - Replaces every `{{variableId}}` with the corresponding answer value.
 * - Unanswered variables become empty string (for optional questions).
 * - Collapses triple+ newlines (left by empty optionals) into double newlines.
 * - Trims leading/trailing whitespace.
 */
export function assemblePrompt(template: PromptTemplate, answers: Record<string, string>): string {
  let prompt = template.promptTemplate

  // Replace all {{variable}} placeholders
  for (const question of template.questions) {
    const value = answers[question.id] ?? ''
    prompt = prompt.replaceAll(`{{${question.id}}}`, value)
  }

  // Also replace any {{key}} not in questions (in case answers has extra keys)
  for (const [key, value] of Object.entries(answers)) {
    prompt = prompt.replaceAll(`{{${key}}}`, value)
  }

  // Collapse triple+ newlines into double (cleans up empty optional fields)
  prompt = prompt.replace(/\n{3,}/g, '\n\n')

  return prompt.trim()
}
