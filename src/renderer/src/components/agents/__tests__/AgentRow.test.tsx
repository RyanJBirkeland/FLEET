import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentRow } from '../AgentRow'
import type { AgentMeta } from '../../../../../shared/types'

const base: AgentMeta = {
  id: 'abc123',
  status: 'running',
  task: 'implement feature X',
  model: 'claude-haiku-4-5',
  repo: 'fleet',
  repoPath: '/tmp/fleet',
  startedAt: new Date(Date.now() - 60_000).toISOString(),
  finishedAt: null,
  pid: null,
  bin: 'claude',
  exitCode: null,
  logPath: '/tmp/log',
  source: 'fleet',
  costUsd: null,
  tokensIn: null,
  tokensOut: null,
  sprintTaskId: null
}

describe('AgentRow', () => {
  it('renders agent id and repo', () => {
    render(<AgentRow agent={base} selected={false} onClick={vi.fn()} />)
    expect(screen.getByText('abc123')).toBeDefined()
  })

  it('shows fleet-pulse for running agents', () => {
    const { container } = render(<AgentRow agent={base} selected={false} onClick={vi.fn()} />)
    expect(container.querySelector('.fleet-pulse')).toBeTruthy()
  })

  it('shows static dot for non-running agents', () => {
    const agent = { ...base, status: 'done' as const, finishedAt: new Date().toISOString() }
    const { container } = render(<AgentRow agent={agent} selected={false} onClick={vi.fn()} />)
    expect(container.querySelector('.fleet-pulse')).toBeNull()
    expect(container.querySelector('.fleet-dot--done')).toBeTruthy()
  })

  it('shows progress bar only for running agents', () => {
    const { container: runningContainer } = render(
      <AgentRow agent={base} selected={false} onClick={vi.fn()} progressPct={50} />
    )
    const { container: doneContainer } = render(
      <AgentRow
        agent={{ ...base, status: 'done' as const, finishedAt: new Date().toISOString() }}
        selected={false}
        onClick={vi.fn()}
      />
    )
    expect(runningContainer.querySelector('[data-testid="progress-bar"]')).toBeTruthy()
    expect(doneContainer.querySelector('[data-testid="progress-bar"]')).toBeNull()
  })
})
