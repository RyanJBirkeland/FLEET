import { describe, it, expect } from 'vitest'
import {
  parseReviewResponse,
  MalformedReviewError,
} from './review-service'

describe('parseReviewResponse', () => {
  const validJson = JSON.stringify({
    qualityScore: 92,
    openingMessage: 'Looks good.',
    perFile: [
      {
        path: 'src/foo.ts',
        status: 'issues',
        comments: [
          { line: 10, severity: 'high', category: 'security', message: 'XSS' },
        ],
      },
    ],
  })

  it('parses plain JSON', () => {
    const out = parseReviewResponse(validJson)
    expect(out.qualityScore).toBe(92)
    expect(out.perFile[0]?.path).toBe('src/foo.ts')
  })

  it('strips ```json fences', () => {
    const out = parseReviewResponse('```json\n' + validJson + '\n```')
    expect(out.qualityScore).toBe(92)
  })

  it('strips plain ``` fences', () => {
    const out = parseReviewResponse('```\n' + validJson + '\n```')
    expect(out.qualityScore).toBe(92)
  })

  it('strips leading/trailing prose', () => {
    const out = parseReviewResponse(
      'Here is the review:\n' + validJson + '\nHope that helps!'
    )
    expect(out.qualityScore).toBe(92)
  })

  it('throws MalformedReviewError on non-JSON', () => {
    expect(() => parseReviewResponse('not json at all')).toThrow(MalformedReviewError)
  })

  it('throws on missing required fields', () => {
    expect(() =>
      parseReviewResponse('{"qualityScore": 92}')
    ).toThrow(MalformedReviewError)
  })

  it('throws on qualityScore out of range', () => {
    const bad = JSON.stringify({
      qualityScore: 150,
      openingMessage: 'bad',
      perFile: [],
    })
    expect(() => parseReviewResponse(bad)).toThrow(MalformedReviewError)
  })
})
