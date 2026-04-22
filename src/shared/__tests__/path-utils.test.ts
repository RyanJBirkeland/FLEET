import { describe, it, expect } from 'vitest'
import { getBasename } from '../path-utils'

describe('getBasename', () => {
  describe('POSIX paths', () => {
    it('extracts basename from absolute path', () => {
      expect(getBasename('/Users/ryan/Projects/foo')).toBe('foo')
    })

    it('handles trailing slash', () => {
      expect(getBasename('/Users/ryan/Projects/foo/')).toBe('foo')
    })

    it('handles multiple trailing slashes', () => {
      expect(getBasename('/Users/ryan/Projects/foo///')).toBe('foo')
    })

    it('returns empty string for root path', () => {
      expect(getBasename('/')).toBe('')
    })

    it('returns empty string for multiple slashes', () => {
      expect(getBasename('///')).toBe('')
    })
  })

  describe('Windows paths', () => {
    it('extracts basename from Windows path', () => {
      expect(getBasename('C:\\Users\\ryan\\Projects\\foo')).toBe('foo')
    })

    it('handles trailing backslash', () => {
      expect(getBasename('C:\\Users\\ryan\\Projects\\foo\\')).toBe('foo')
    })

    it('handles mixed separators', () => {
      expect(getBasename('C:\\Users\\ryan/Projects/foo')).toBe('foo')
    })

    it('returns empty string for Windows root', () => {
      expect(getBasename('C:\\')).toBe('')
    })
  })

  describe('edge cases', () => {
    it('returns the name itself when no separators', () => {
      expect(getBasename('foo')).toBe('foo')
    })

    it('returns empty string for empty input', () => {
      expect(getBasename('')).toBe('')
    })

    it('handles relative paths', () => {
      expect(getBasename('./foo/bar')).toBe('bar')
      expect(getBasename('../foo/bar')).toBe('bar')
    })

    it('handles single segment with trailing slash', () => {
      expect(getBasename('foo/')).toBe('foo')
    })
  })
})
