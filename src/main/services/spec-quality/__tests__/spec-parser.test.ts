import { describe, it, expect } from 'vitest'
import { SpecParser } from '../spec-parser'

describe('SpecParser', () => {
  const parser = new SpecParser()

  describe('sections', () => {
    it('parses multiple ## sections into correct sections array', () => {
      const spec = `## Overview
This is the overview.

## Files to Change
- src/foo.ts
- src/bar.ts

## How to Test
Run the tests.`

      const result = parser.parse(spec)

      expect(result.sections).toHaveLength(3)

      expect(result.sections[0].heading).toBe('## Overview')
      expect(result.sections[0].level).toBe(2)
      expect(result.sections[0].content).toContain('This is the overview.')

      expect(result.sections[1].heading).toBe('## Files to Change')
      expect(result.sections[1].level).toBe(2)
      expect(result.sections[1].content).toContain('src/foo.ts')

      expect(result.sections[2].heading).toBe('## How to Test')
      expect(result.sections[2].level).toBe(2)
      expect(result.sections[2].content).toContain('Run the tests.')
    })

    it('parses ### sub-sections with level 3', () => {
      const spec = `## Implementation Steps
### Step 1
Do the first thing.

### Step 2
Do the second thing.`

      const result = parser.parse(spec)

      expect(result.sections).toHaveLength(3)

      expect(result.sections[0].heading).toBe('## Implementation Steps')
      expect(result.sections[0].level).toBe(2)

      expect(result.sections[1].heading).toBe('### Step 1')
      expect(result.sections[1].level).toBe(3)
      expect(result.sections[1].content).toBe('Do the first thing.')

      expect(result.sections[2].heading).toBe('### Step 2')
      expect(result.sections[2].level).toBe(3)
      expect(result.sections[2].content).toBe('Do the second thing.')
    })

    it('returns empty sections array for an empty spec', () => {
      const result = parser.parse('')
      expect(result.sections).toHaveLength(0)
    })

    it('returns empty sections array for whitespace-only spec', () => {
      const result = parser.parse('   \n  \n  ')
      expect(result.sections).toHaveLength(0)
    })

    it('ignores # h1 headings', () => {
      const spec = `# Title
Some intro text.

## Overview
The real content.`

      const result = parser.parse(spec)

      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].heading).toBe('## Overview')
    })

    it('ignores #### and deeper headings', () => {
      const spec = `## Overview
Content here.

#### Deep heading
This should not be a section.`

      const result = parser.parse(spec)

      expect(result.sections).toHaveLength(1)
      expect(result.sections[0].heading).toBe('## Overview')
      expect(result.sections[0].content).toContain('Deep heading')
    })

    it('preserves content between sections correctly', () => {
      const spec = `## Section A
Line 1
Line 2

## Section B
Line 3`

      const result = parser.parse(spec)

      expect(result.sections[0].content).toBe('Line 1\nLine 2')
      expect(result.sections[1].content).toBe('Line 3')
    })
  })

  describe('wordCount', () => {
    it('computes approximate word count for a normal spec', () => {
      const spec = 'one two three four five'
      const result = parser.parse(spec)
      expect(result.wordCount).toBe(5)
    })

    it('handles multi-line content word count', () => {
      const spec = `## Overview
This has four words.

## Files
Just three here.`

      const result = parser.parse(spec)
      // "Overview", "This", "has", "four", "words.", "##", "Files", "Just", "three", "here." + "##"
      // rough count — just verify it's non-zero and in the right ballpark
      expect(result.wordCount).toBeGreaterThan(5)
    })

    it('returns 0 word count for empty spec', () => {
      const result = parser.parse('')
      expect(result.wordCount).toBe(0)
    })
  })

  describe('raw passthrough', () => {
    it('preserves the raw input string unchanged', () => {
      const raw = '## Overview\nSome content.\n'
      const result = parser.parse(raw)
      expect(result.raw).toBe(raw)
    })
  })
})
