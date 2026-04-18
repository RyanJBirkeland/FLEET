import { ZodError } from 'zod'

export enum McpErrorCode {
  NotFound = 'NOT_FOUND',
  InvalidTransition = 'INVALID_TRANSITION',
  Cycle = 'CYCLE',
  ForbiddenField = 'FORBIDDEN_FIELD'
}

export class McpDomainError extends Error {
  constructor(
    message: string,
    public readonly kind: McpErrorCode,
    public readonly data?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'McpDomainError'
  }
}

export interface JsonRpcErrorBody {
  code: number
  message: string
  data?: unknown
}

const CODE_MAP: Record<McpErrorCode, number> = {
  [McpErrorCode.NotFound]: -32001,
  [McpErrorCode.InvalidTransition]: -32002,
  [McpErrorCode.Cycle]: -32003,
  [McpErrorCode.ForbiddenField]: -32004
}

export function toJsonRpcError(err: unknown): JsonRpcErrorBody {
  if (err instanceof ZodError) {
    return {
      code: -32602,
      message: `Invalid params: ${err.issues.map((i) => i.message).join('; ')}`,
      data: { issues: err.issues }
    }
  }
  if (err instanceof McpDomainError) {
    return { code: CODE_MAP[err.kind], message: err.message, data: err.data }
  }
  return { code: -32603, message: 'Internal error' }
}
