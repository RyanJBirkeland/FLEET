import { describe, it, expect, vi } from 'vitest'
import { closeQuietly } from './close-quietly'

vi.mock('../logger', () => ({
  logError: (
    logger: { error: (m: string) => void; debug: (m: string) => void },
    context: string,
    err: unknown
  ) => {
    if (err instanceof Error) {
      logger.error(`${context}: ${err.message}`)
      if (err.stack) logger.debug(`Stack: ${err.stack.split('\n').slice(1, 4).join(' | ')}`)
    } else {
      logger.error(`${context}: ${String(err)}`)
    }
  }
}))

function makeLogger(): {
  info: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
  debug: ReturnType<typeof vi.fn>
} {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}

describe('closeQuietly', () => {
  it('resolves and does not log when close() succeeds', async () => {
    const logger = makeLogger()
    const closable = { close: vi.fn(async () => {}) }

    await expect(closeQuietly(closable, 'transport', logger)).resolves.toBeUndefined()

    expect(closable.close).toHaveBeenCalledTimes(1)
    expect(logger.error).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('resolves and still does not throw when close() is synchronous', async () => {
    const logger = makeLogger()
    const closable = { close: vi.fn(() => undefined) }

    await expect(closeQuietly(closable, 'transport', logger)).resolves.toBeUndefined()
    expect(closable.close).toHaveBeenCalledTimes(1)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('swallows a rejected close and logs the error with label context', async () => {
    const logger = makeLogger()
    const err = new Error('transport kaboom')
    const closable = { close: vi.fn(async () => { throw err }) }

    await expect(closeQuietly(closable, 'transport', logger)).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('transport close: transport kaboom'))
    // Stack preserved via logError → debug channel.
    expect(logger.debug).toHaveBeenCalled()
    const debugArg = logger.debug.mock.calls[0]?.[0] as string
    expect(debugArg).toMatch(/Stack:/)
  })

  it('logs non-Error throws as strings without losing the label', async () => {
    const logger = makeLogger()
    const closable = { close: vi.fn(async () => { throw 'raw-string' }) }

    await expect(closeQuietly(closable, 'mcp server', logger)).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith('mcp server close: raw-string')
  })
})
