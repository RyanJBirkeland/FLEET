import { describe, it, expect, vi } from 'vitest'
import { registerEpicTools, type EpicToolsDeps } from './epics'
import { EpicCycleError, EpicNotFoundError } from '../../services/epic-group-service'
import type { TaskGroup } from '../../../shared/types'

type ToolResult = {
  isError?: boolean
  content: Array<{ type: 'text'; text: string }>
}
type ToolHandler = (args: unknown) => Promise<ToolResult>

function mockServer() {
  const handlers = new Map<string, ToolHandler>()
  return {
    server: {
      tool: (name: string, _d: string, _s: unknown, h: ToolHandler) => {
        handlers.set(name, h)
      }
    } as any,
    call: (name: string, args: unknown): Promise<ToolResult> => handlers.get(name)!(args)
  }
}

function parseErrorBody(res: ToolResult): { code: number; message: string; data?: unknown } {
  expect(res.isError).toBe(true)
  return JSON.parse(res.content[0].text)
}

const fakeGroup = (overrides: Partial<TaskGroup> = {}): TaskGroup => ({
  id: 'g1',
  name: 'E1',
  icon: 'G',
  accent_color: '#0ff',
  goal: null,
  status: 'draft',
  created_at: '2026-04-17T00:00:00.000Z',
  updated_at: '2026-04-17T00:00:00.000Z',
  depends_on: null,
  ...overrides
})

function fakeDeps(over: Partial<EpicToolsDeps> = {}): EpicToolsDeps {
  const svc = {
    listEpics: vi.fn(() => [fakeGroup()]),
    getEpic: vi.fn(() => fakeGroup()),
    getEpicTasks: vi.fn(() => []),
    createEpic: vi.fn((i) => fakeGroup({ id: 'new', ...i })),
    updateEpic: vi.fn((id, patch) => fakeGroup({ id, ...patch })),
    deleteEpic: vi.fn(),
    addTask: vi.fn(),
    removeTask: vi.fn(),
    reorderTasks: vi.fn(),
    queueAllTasks: vi.fn(() => 0),
    addDependency: vi.fn((id, dep) => fakeGroup({ id, depends_on: [dep] })),
    removeDependency: vi.fn((id) => fakeGroup({ id })),
    updateDependencyCondition: vi.fn((id) => fakeGroup({ id })),
    setDependencies: vi.fn((id, deps) => fakeGroup({ id, depends_on: [...deps] }))
  }
  return { epicService: svc as any, ...over }
}

describe('epics.* tools', () => {
  it('epics.list returns JSON text', async () => {
    const { server, call } = mockServer()
    registerEpicTools(server, fakeDeps())
    const res = await call('epics.list', {})
    expect(Array.isArray(JSON.parse(res.content[0].text))).toBe(true)
  })

  it('epics.get returns structured NotFound payload when missing', async () => {
    const deps = fakeDeps()
    ;(deps.epicService.getEpic as any).mockReturnValue(null)
    const { server, call } = mockServer()
    registerEpicTools(server, deps)
    const res = await call('epics.get', { id: 'missing' })
    const body = parseErrorBody(res)
    expect(body.code).toBe(-32001)
    expect(body.message).toMatch(/not found/)
    expect(body.data).toMatchObject({ id: 'missing' })
  })

  it('epics.get includes tasks when includeTasks is true', async () => {
    const deps = fakeDeps()
    const { server, call } = mockServer()
    registerEpicTools(server, deps)
    const res = await call('epics.get', { id: 'g1', includeTasks: true })
    const body = JSON.parse(res.content[0].text)
    expect(body).toHaveProperty('tasks')
    expect(deps.epicService.getEpicTasks).toHaveBeenCalledWith('g1')
  })

  it('epics.create delegates to service', async () => {
    const deps = fakeDeps()
    const { server, call } = mockServer()
    registerEpicTools(server, deps)
    const res = await call('epics.create', { name: 'new' })
    expect(deps.epicService.createEpic).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'new' })
    )
    expect(JSON.parse(res.content[0].text).id).toBe('new')
  })

  it('epics.setDependencies delegates to service.setDependencies (atomic)', async () => {
    const deps = fakeDeps()
    const { server, call } = mockServer()
    registerEpicTools(server, deps)
    await call('epics.setDependencies', {
      id: 'g1',
      dependencies: [{ id: 'new', condition: 'always' }]
    })
    expect(deps.epicService.setDependencies).toHaveBeenCalledWith('g1', [
      { id: 'new', condition: 'always' }
    ])
    // Handler must delegate atomically — it must NOT re-implement the diff
    // loop against addDependency/removeDependency itself.
    expect(deps.epicService.removeDependency).not.toHaveBeenCalled()
    expect(deps.epicService.addDependency).not.toHaveBeenCalled()
  })

  it('epics.setDependencies returns structured NotFound payload when EpicNotFoundError is thrown', async () => {
    const deps = fakeDeps()
    ;(deps.epicService.setDependencies as any).mockImplementation(() => {
      throw new EpicNotFoundError('missing')
    })
    const { server, call } = mockServer()
    registerEpicTools(server, deps)
    const res = await call('epics.setDependencies', { id: 'missing', dependencies: [] })
    const body = parseErrorBody(res)
    expect(body.code).toBe(-32001)
    expect(body.message).toMatch(/not found/i)
    expect(body.data).toMatchObject({ id: 'missing' })
  })

  it('epics.setDependencies returns structured Cycle payload when EpicCycleError is thrown', async () => {
    const deps = fakeDeps()
    ;(deps.epicService.setDependencies as any).mockImplementation(() => {
      throw new EpicCycleError('g1', 'g1 -> g2 -> g1')
    })
    const { server, call } = mockServer()
    registerEpicTools(server, deps)
    const res = await call('epics.setDependencies', { id: 'g1', dependencies: [] })
    const body = parseErrorBody(res)
    expect(body.code).toBe(-32003)
    expect(body.message).toMatch(/cycle/i)
    expect(body.data).toMatchObject({ id: 'g1' })
  })

  it('epics.setDependencies propagates unknown throws unchanged', async () => {
    const deps = fakeDeps()
    ;(deps.epicService.setDependencies as any).mockImplementation(() => {
      throw new Error('something broke')
    })
    const { server, call } = mockServer()
    registerEpicTools(server, deps)
    await expect(call('epics.setDependencies', { id: 'g1', dependencies: [] })).rejects.toThrow(
      /something broke/
    )
  })
})
