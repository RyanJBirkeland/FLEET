import type { IncomingMessage } from 'node:http'
import { timingSafeEqual } from 'node:crypto'

export type AuthResult =
  | { ok: true }
  | { ok: false; status: 401; message: string }

function deny(message: string): AuthResult {
  return { ok: false, status: 401, message }
}

export function checkBearerAuth(req: IncomingMessage, expected: string): AuthResult {
  const header = req.headers.authorization
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return deny('missing bearer token')
  }
  const presented = header.slice('Bearer '.length).trim()
  if (presented.length !== expected.length) {
    return deny('invalid bearer token')
  }
  const a = Buffer.from(presented, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (!timingSafeEqual(a, b)) {
    return deny('invalid bearer token')
  }
  return { ok: true }
}
