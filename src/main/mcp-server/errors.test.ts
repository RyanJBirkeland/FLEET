import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { toJsonRpcError, McpDomainError, McpErrorCode } from './errors'

describe('toJsonRpcError', () => {
  it('maps zod ZodError to -32602 Invalid params', () => {
    const schema = z.object({ id: z.string() })
    let caught: unknown
    try { schema.parse({}) } catch (err) { caught = err }
    const mapped = toJsonRpcError(caught)
    expect(mapped.code).toBe(-32602)
    expect(mapped.message).toMatch(/invalid/i)
    expect(mapped.data).toBeDefined()
  })

  it('maps McpDomainError with code NOT_FOUND to -32001', () => {
    const err = new McpDomainError('Task xyz not found', McpErrorCode.NotFound, { id: 'xyz' })
    const mapped = toJsonRpcError(err)
    expect(mapped.code).toBe(-32001)
    expect(mapped.data).toEqual({ id: 'xyz' })
  })

  it('maps McpDomainError with code INVALID_TRANSITION to -32002', () => {
    const err = new McpDomainError('bad transition', McpErrorCode.InvalidTransition)
    expect(toJsonRpcError(err).code).toBe(-32002)
  })

  it('maps McpDomainError with code CYCLE to -32003', () => {
    const err = new McpDomainError('cycle', McpErrorCode.Cycle)
    expect(toJsonRpcError(err).code).toBe(-32003)
  })

  it('maps McpDomainError with code FORBIDDEN_FIELD to -32004', () => {
    const err = new McpDomainError('nope', McpErrorCode.ForbiddenField)
    expect(toJsonRpcError(err).code).toBe(-32004)
  })

  it('maps any other thrown value to -32603 Internal error without leaking stack', () => {
    const mapped = toJsonRpcError(new Error('oops stack trace details'))
    expect(mapped.code).toBe(-32603)
    expect(mapped.message).toBe('Internal error')
  })
})
