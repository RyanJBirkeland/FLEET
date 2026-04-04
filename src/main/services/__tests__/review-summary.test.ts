import { describe, it, expect } from 'vitest'
import { buildReviewSummaryPrompt } from '../review-summary'

describe('buildReviewSummaryPrompt', () => {
  it('includes file count and diff stat in prompt', () => {
    const diffStat = ' src/main.ts | 5 ++---\n 1 file changed, 2 insertions(+), 3 deletions(-)'
    const prompt = buildReviewSummaryPrompt(diffStat, 'Fix login bug')
    expect(prompt).toContain('1 file changed')
    expect(prompt).toContain('Fix login bug')
    expect(prompt).toContain('summary')
  })

  it('truncates very large diffs', () => {
    const largeDiff = 'x'.repeat(20000)
    const prompt = buildReviewSummaryPrompt(largeDiff, 'Big change')
    expect(prompt.length).toBeLessThan(16000)
  })
})
