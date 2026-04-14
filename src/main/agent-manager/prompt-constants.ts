/**
 * prompt-constants.ts — Shared truncation limits for all prompt builders.
 *
 * Single source of truth. Import from here rather than scattering magic numbers.
 */

/**
 * Maximum character counts for truncating user-supplied content before
 * injecting into agent prompts.
 *
 * TASK_SPEC_CHARS: 8000 chars (~2000 words) covers CLAUDE.md's "under 500 words"
 * guideline with headroom for Files to Change, How to Test, and Out of Scope sections.
 *
 * UPSTREAM_SPEC_CHARS: 2000 chars per upstream task spec summary.
 *
 * UPSTREAM_DIFF_CHARS: 2000 chars per upstream diff — partial diffs for context only.
 */
export const PROMPT_TRUNCATION = {
  TASK_SPEC_CHARS: 8000,
  UPSTREAM_SPEC_CHARS: 2000,
  UPSTREAM_DIFF_CHARS: 2000,
} as const
