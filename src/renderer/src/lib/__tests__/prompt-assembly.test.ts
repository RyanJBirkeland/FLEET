import { describe, it, expect } from 'vitest'
import { assemblePrompt } from '../prompt-assembly'
import type { PromptTemplate } from '../launchpad-types'

const mockTemplate: PromptTemplate = {
  id: 'test-1',
  name: 'Test',
  icon: '🧪',
  accent: 'cyan',
  description: 'Test template',
  questions: [
    { id: 'scope', label: 'Scope?', type: 'choice', choices: ['All', 'Some'] },
    { id: 'focus', label: 'Focus?', type: 'text' }
  ],
  promptTemplate: 'Audit {{scope}} focusing on {{focus}}.',
  order: 0
}

describe('assemblePrompt', () => {
  it('replaces all {{variable}} placeholders with answers', () => {
    const result = assemblePrompt(mockTemplate, { scope: 'Entire repo', focus: 'naming' })
    expect(result).toBe('Audit Entire repo focusing on naming.')
  })

  it('replaces multiple occurrences of the same variable', () => {
    const template: PromptTemplate = {
      ...mockTemplate,
      promptTemplate: '{{scope}} first, then {{scope}} again.'
    }
    const result = assemblePrompt(template, { scope: 'All' })
    expect(result).toBe('All first, then All again.')
  })

  it('leaves unanswered optional placeholders as empty string', () => {
    const result = assemblePrompt(mockTemplate, { scope: 'All' })
    expect(result).toBe('Audit All focusing on .')
  })

  it('trims leading/trailing whitespace from result', () => {
    const template: PromptTemplate = {
      ...mockTemplate,
      promptTemplate: '  {{scope}}  '
    }
    const result = assemblePrompt(template, { scope: 'All' })
    expect(result).toBe('All')
  })

  it('collapses triple+ newlines left by empty optional fields', () => {
    const template: PromptTemplate = {
      ...mockTemplate,
      promptTemplate: 'Line one.\n\n{{focus}}\n\nLine three.'
    }
    const result = assemblePrompt(template, { focus: '' })
    expect(result).toBe('Line one.\n\nLine three.')
  })

  it('handles empty answers object', () => {
    const result = assemblePrompt(mockTemplate, {})
    expect(result).toBe('Audit  focusing on .')
  })
})
