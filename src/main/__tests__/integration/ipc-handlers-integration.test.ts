import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// --- Electron mock: capture ipcMain.handle registrations ---

const handlers = new Map<string, Function>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: Function) => handlers.set(channel, handler)),
    on: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
  },
}))

// --- Mock auth-guard ---

const { mockCheckAuthStatus } = vi.hoisted(() => ({
  mockCheckAuthStatus: vi.fn(),
}))

vi.mock('../../auth-guard', () => ({
  checkAuthStatus: mockCheckAuthStatus,
}))

// --- Mock runner-client ---

const { mockListAgents, mockKillAgent } = vi.hoisted(() => ({
  mockListAgents: vi.fn().mockResolvedValue([]),
  mockKillAgent: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('../../runner-client', () => ({
  listAgents: mockListAgents,
  killAgent: mockKillAgent,
}))

import { registerAuthHandlers } from '../../handlers/auth-handlers'
import { registerAgentManagerHandlers } from '../../handlers/agent-manager-handlers'

// Fake IPC event
const fakeEvent = { sender: {} } as Electron.IpcMainInvokeEvent

/** Invoke a captured IPC handler. */
function invoke(channel: string, ...args: unknown[]): unknown {
  const handler = handlers.get(channel)
  if (!handler) throw new Error(`No handler registered for "${channel}"`)
  return handler(fakeEvent, ...args)
}

describe('IPC handlers integration', () => {
  // ── Auth handlers ──────────────────────────────────────────────────

  describe('auth:status handler', () => {
    beforeAll(() => {
      handlers.clear()
      registerAuthHandlers()
    })

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('registers the auth:status channel', () => {
      expect(handlers.has('auth:status')).toBe(true)
    })

    it('returns correct shape with valid token', async () => {
      const expiresAt = new Date(Date.now() + 3_600_000)
      mockCheckAuthStatus.mockResolvedValue({
        cliFound: true,
        tokenFound: true,
        tokenExpired: false,
        expiresAt,
      })

      const result = (await invoke('auth:status')) as {
        cliFound: boolean
        tokenFound: boolean
        tokenExpired: boolean
        expiresAt?: string
      }

      expect(result).toEqual({
        cliFound: true,
        tokenFound: true,
        tokenExpired: false,
        expiresAt: expiresAt.toISOString(),
      })
    })

    it('returns correct shape with expired token', async () => {
      mockCheckAuthStatus.mockResolvedValue({
        cliFound: true,
        tokenFound: true,
        tokenExpired: true,
        expiresAt: new Date(Date.now() - 3_600_000),
      })

      const result = (await invoke('auth:status')) as {
        cliFound: boolean
        tokenFound: boolean
        tokenExpired: boolean
        expiresAt?: string
      }

      expect(result.tokenExpired).toBe(true)
      expect(result.expiresAt).toBeDefined()
    })

    it('returns correct shape with no token', async () => {
      mockCheckAuthStatus.mockResolvedValue({
        cliFound: true,
        tokenFound: false,
        tokenExpired: false,
      })

      const result = (await invoke('auth:status')) as {
        cliFound: boolean
        tokenFound: boolean
        tokenExpired: boolean
        expiresAt?: string
      }

      expect(result).toEqual({
        cliFound: true,
        tokenFound: false,
        tokenExpired: false,
        expiresAt: undefined,
      })
    })

    it('returns cliFound=false when CLI not installed', async () => {
      mockCheckAuthStatus.mockResolvedValue({
        cliFound: false,
        tokenFound: false,
        tokenExpired: false,
      })

      const result = (await invoke('auth:status')) as { cliFound: boolean }
      expect(result.cliFound).toBe(false)
    })
  })

  // ── Agent manager handlers ─────────────────────────────────────────

  describe('agent-manager handlers', () => {
    beforeAll(() => {
      handlers.clear()
      registerAgentManagerHandlers()
    })

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('registers agent-manager:status channel', () => {
      expect(handlers.has('agent-manager:status')).toBe(true)
    })

    it('registers agent-manager:kill channel', () => {
      expect(handlers.has('agent-manager:kill')).toBe(true)
    })

    it('agent-manager:status returns { activeCount, availableSlots } from runner', async () => {
      mockListAgents.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }])

      const result = (await invoke('agent-manager:status')) as {
        activeCount: number
        availableSlots: number | null
      }

      expect(result).toEqual({
        activeCount: 2,
        availableSlots: null,
      })
    })

    it('agent-manager:status returns zero when runner is unreachable', async () => {
      mockListAgents.mockRejectedValue(new Error('Connection refused'))

      const result = (await invoke('agent-manager:status')) as {
        activeCount: number
        availableSlots: number | null
      }

      expect(result).toEqual({
        activeCount: 0,
        availableSlots: null,
      })
    })

    it('agent-manager:kill calls killAgent on runner', async () => {
      mockKillAgent.mockResolvedValue({ ok: true })

      const result = await invoke('agent-manager:kill', 'agent-123')

      expect(mockKillAgent).toHaveBeenCalledWith('agent-123')
      expect(result).toEqual({ ok: true })
    })
  })
})
