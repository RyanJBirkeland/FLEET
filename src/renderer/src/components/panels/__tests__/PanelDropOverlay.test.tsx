import { describe, it, expect } from 'vitest'
import { getDropZone } from '../PanelDropOverlay'

// ---------------------------------------------------------------------------
// Tests for getDropZone pure function
// ---------------------------------------------------------------------------

const rect = { left: 0, top: 0, width: 400, height: 300 }

describe('getDropZone', () => {
  it('returns top for upper 25%', () => expect(getDropZone(200, 30, rect)).toBe('top'))
  it('returns bottom for lower 25%', () => expect(getDropZone(200, 270, rect)).toBe('bottom'))
  it('returns left for left 25% (mid-height)', () => expect(getDropZone(50, 150, rect)).toBe('left'))
  it('returns right for right 25% (mid-height)', () => expect(getDropZone(350, 150, rect)).toBe('right'))
  it('returns center for middle', () => expect(getDropZone(200, 150, rect)).toBe('center'))
  it('top takes priority over left in top-left corner', () => expect(getDropZone(30, 30, rect)).toBe('top'))
  it('bottom takes priority over right in bottom-right corner', () => expect(getDropZone(370, 270, rect)).toBe('bottom'))
})
