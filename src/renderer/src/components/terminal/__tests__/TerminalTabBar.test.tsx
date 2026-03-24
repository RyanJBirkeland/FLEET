import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TerminalTabBar } from '../TerminalTabBar'
import type { TerminalTab } from '../../../stores/terminal'

// Mock child pickers — they open popovers that aren't relevant here
vi.mock('../ShellPicker', () => ({
  ShellPicker: () => null,
}))

vi.mock('../AgentPicker', () => ({
  AgentPicker: () => null,
}))

function makeTab(overrides: Partial<TerminalTab> = {}): TerminalTab {
  return {
    id: 'tab-1',
    title: 'Terminal 1',
    kind: 'shell',
    shell: '/bin/zsh',
    ptyId: null,
    isLabelCustom: false,
    status: 'running',
    hasUnread: false,
    ...overrides,
  }
}

const defaultProps = {
  tabs: [makeTab()],
  activeTabId: 'tab-1',
  onSelectTab: vi.fn(),
  onCloseTab: vi.fn(),
  onAddTab: vi.fn(),
  onCreateAgentTab: vi.fn(),
}

describe('TerminalTabBar', () => {
  it('renders tab labels', () => {
    const tabs = [
      makeTab({ id: 'tab-1', title: 'Terminal 1' }),
      makeTab({ id: 'tab-2', title: 'Terminal 2' }),
    ]
    render(<TerminalTabBar {...defaultProps} tabs={tabs} activeTabId="tab-1" />)
    expect(screen.getByText('Terminal 1')).toBeInTheDocument()
    expect(screen.getByText('Terminal 2')).toBeInTheDocument()
  })

  it('calls onSelectTab when a tab is clicked', async () => {
    const onSelectTab = vi.fn()
    const tabs = [
      makeTab({ id: 'tab-1', title: 'Terminal 1' }),
      makeTab({ id: 'tab-2', title: 'Terminal 2' }),
    ]
    const user = userEvent.setup()
    render(
      <TerminalTabBar
        {...defaultProps}
        tabs={tabs}
        activeTabId="tab-1"
        onSelectTab={onSelectTab}
      />
    )
    await user.click(screen.getByText('Terminal 2'))
    expect(onSelectTab).toHaveBeenCalledWith('tab-2')
  })

  it('renders the add button', () => {
    render(<TerminalTabBar {...defaultProps} />)
    // The add button has title "New terminal (⌘T)"
    expect(screen.getByTitle('New terminal (⌘T)')).toBeInTheDocument()
  })

  it('calls onAddTab when add button is clicked', async () => {
    const onAddTab = vi.fn()
    const user = userEvent.setup()
    render(<TerminalTabBar {...defaultProps} onAddTab={onAddTab} />)
    await user.click(screen.getByTitle('New terminal (⌘T)'))
    expect(onAddTab).toHaveBeenCalled()
  })

  it('renders agent tab with bot icon class', () => {
    const agentTab = makeTab({ id: 'agent-1', title: 'My Agent', kind: 'agent', agentId: 'a1' })
    render(
      <TerminalTabBar
        {...defaultProps}
        tabs={[agentTab]}
        activeTabId="agent-1"
      />
    )
    expect(screen.getByText('My Agent')).toBeInTheDocument()
  })
})
