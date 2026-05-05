import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentInspector } from '../AgentInspector'
import type { AgentMeta } from '../../../../../shared/types'

vi.mock('../../sprint/primitives/MiniStat', () => ({
  MiniStat: ({ label, value }: { label: string; value: string }) => (
    <div data-testid={`ministat-${label}`}>{value}</div>
  ),
}))

vi.mock('../../dashboard/primitives/MicroSpark', () => ({
  MicroSpark: () => <div data-testid="microspark" />,
}))

const agent: AgentMeta = {
  id: 'abc123',
  status: 'running',
  task: 'implement feature X',
  model: 'claude-haiku-4-5',
  repo: 'fleet',
  repoPath: '/tmp/fleet',
  startedAt: new Date(Date.now() - 300_000).toISOString(),
  finishedAt: null,
  pid: 1234,
  bin: 'claude',
  exitCode: null,
  logPath: '/tmp/log',
  source: 'fleet',
  costUsd: 0.0012,
  tokensIn: 5000,
  tokensOut: 2000,
  sprintTaskId: null,
}

describe('AgentInspector', () => {
  it('renders all six section eyebrows', () => {
    render(<AgentInspector agent={agent} events={[]} />)
    expect(screen.getByText('SENT TO AGENT')).toBeDefined()
    expect(screen.getByText('ON DISK')).toBeDefined()
    expect(screen.getByText('WORKSPACE')).toBeDefined()
    expect(screen.getByText('SCOPE')).toBeDefined()
    expect(screen.getByText('TELEMETRY')).toBeDefined()
    expect(screen.getByText('TRACE')).toBeDefined()
  })

  it('renders section titles', () => {
    render(<AgentInspector agent={agent} events={[]} />)
    expect(screen.getByText('Task prompt')).toBeDefined()
    expect(screen.getByText('Task spec')).toBeDefined()
    expect(screen.getByText('Worktree')).toBeDefined()
    expect(screen.getByText('Files touched')).toBeDefined()
    expect(screen.getByText('Run metrics')).toBeDefined()
    expect(screen.getByText('Recent timeline')).toBeDefined()
  })

  it('renders MiniStat tiles for run metrics', () => {
    render(<AgentInspector agent={agent} events={[]} />)
    expect(screen.getByTestId('ministat-tokens')).toBeDefined()
    expect(screen.getByTestId('ministat-cost')).toBeDefined()
    expect(screen.getByTestId('ministat-tools')).toBeDefined()
    expect(screen.getByTestId('ministat-elapsed')).toBeDefined()
  })
})
