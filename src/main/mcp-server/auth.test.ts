import { describe, it, expect } from 'vitest'
import { checkBearerAuth } from './auth'
import type { IncomingMessage } from 'node:http'

function fakeReq(headers: Record<string, string>): IncomingMessage {
  return { headers } as unknown as IncomingMessage
}

describe('checkBearerAuth', () => {
  const token = 'a'.repeat(64)

  it('returns ok when Authorization matches', () => {
    const result = checkBearerAuth(fakeReq({ authorization: `Bearer ${token}` }), token)
    expect(result.ok).toBe(true)
  })

  it('returns 401 when header is missing', () => {
    const result = checkBearerAuth(fakeReq({}), token)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('returns 401 when scheme is not Bearer', () => {
    const result = checkBearerAuth(fakeReq({ authorization: `Basic ${token}` }), token)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('returns 401 when token differs', () => {
    const other = 'b'.repeat(64)
    const result = checkBearerAuth(fakeReq({ authorization: `Bearer ${other}` }), token)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('returns 401 when token length differs (avoids timingSafeEqual throw)', () => {
    const result = checkBearerAuth(fakeReq({ authorization: `Bearer short` }), token)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })
})
