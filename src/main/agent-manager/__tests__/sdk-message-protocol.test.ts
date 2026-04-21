import { describe, it, expect } from 'vitest'
import {
  asSDKMessage,
  getNumericField,
  getSessionId,
  isRateLimitMessage
} from '../sdk-message-protocol'

describe('asSDKMessage', () => {
  it('returns null for null', () => {
    expect(asSDKMessage(null)).toBeNull()
  })

  it('returns null for non-object primitives', () => {
    expect(asSDKMessage('string')).toBeNull()
    expect(asSDKMessage(42)).toBeNull()
    expect(asSDKMessage(undefined)).toBeNull()
    expect(asSDKMessage(true)).toBeNull()
  })

  it('returns the object cast as SDKWireMessage for valid objects', () => {
    const msg = { type: 'assistant', text: 'hello' }
    expect(asSDKMessage(msg)).toBe(msg)
  })

  it('returns empty object cast as SDKWireMessage', () => {
    const msg = {}
    expect(asSDKMessage(msg)).toBe(msg)
  })

  it('accepts a well-formed assistant message with content array', () => {
    const msg = {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'hi' }]
      }
    }
    expect(asSDKMessage(msg)).toBe(msg)
  })

  it('accepts a message with an empty content array', () => {
    const msg = { type: 'assistant', message: { content: [] } }
    expect(asSDKMessage(msg)).toBe(msg)
  })

  it('accepts a message whose nested message has no content field', () => {
    const msg = { type: 'assistant', message: { role: 'assistant' } }
    expect(asSDKMessage(msg)).toBe(msg)
  })

  it('returns null when nested message is a non-object', () => {
    expect(asSDKMessage({ type: 'assistant', message: 'oops' })).toBeNull()
    expect(asSDKMessage({ type: 'assistant', message: 42 })).toBeNull()
    expect(asSDKMessage({ type: 'assistant', message: null })).toBeNull()
    expect(asSDKMessage({ type: 'assistant', message: true })).toBeNull()
  })

  it('returns null when nested message.content is not an array', () => {
    expect(asSDKMessage({ message: { content: 'not an array' } })).toBeNull()
    expect(asSDKMessage({ message: { content: { 0: 'block' } } })).toBeNull()
    expect(asSDKMessage({ message: { content: 42 } })).toBeNull()
    expect(asSDKMessage({ message: { content: null } })).toBeNull()
  })
})

describe('getNumericField', () => {
  it('returns undefined for null input', () => {
    expect(getNumericField(null, 'cost_usd')).toBeUndefined()
  })

  it('returns undefined when field is missing', () => {
    expect(getNumericField({ type: 'system' }, 'cost_usd')).toBeUndefined()
  })

  it('returns undefined when field is not a number', () => {
    expect(getNumericField({ cost_usd: 'free' }, 'cost_usd')).toBeUndefined()
    expect(getNumericField({ cost_usd: null }, 'cost_usd')).toBeUndefined()
  })

  it('returns numeric value when field is a number', () => {
    expect(getNumericField({ cost_usd: 1.23 }, 'cost_usd')).toBe(1.23)
  })

  it('returns 0 when field is 0', () => {
    expect(getNumericField({ exit_code: 0 }, 'exit_code')).toBe(0)
  })

  it('extracts exit_code field', () => {
    expect(getNumericField({ exit_code: 1 }, 'exit_code')).toBe(1)
  })

  it('extracts total_cost_usd field', () => {
    expect(getNumericField({ total_cost_usd: 5.0 }, 'total_cost_usd')).toBe(5.0)
  })
})

describe('getSessionId', () => {
  it('returns undefined for null', () => {
    expect(getSessionId(null)).toBeUndefined()
  })

  it('returns undefined when session_id missing', () => {
    expect(getSessionId({ type: 'system' })).toBeUndefined()
  })

  it('returns undefined when session_id is not a string', () => {
    expect(getSessionId({ session_id: 42 })).toBeUndefined()
    expect(getSessionId({ session_id: null })).toBeUndefined()
  })

  it('returns session_id when present as string', () => {
    expect(getSessionId({ session_id: 'abc-123' })).toBe('abc-123')
  })
})

describe('isRateLimitMessage', () => {
  it('returns false for null', () => {
    expect(isRateLimitMessage(null)).toBe(false)
  })

  it('returns false when type is not system', () => {
    expect(isRateLimitMessage({ type: 'assistant', subtype: 'rate_limit' })).toBe(false)
  })

  it('returns false when subtype is not rate_limit', () => {
    expect(isRateLimitMessage({ type: 'system', subtype: 'other' })).toBe(false)
  })

  it('returns false when subtype is missing', () => {
    expect(isRateLimitMessage({ type: 'system' })).toBe(false)
  })

  it('returns true for system/rate_limit messages', () => {
    expect(isRateLimitMessage({ type: 'system', subtype: 'rate_limit' })).toBe(true)
  })
})
