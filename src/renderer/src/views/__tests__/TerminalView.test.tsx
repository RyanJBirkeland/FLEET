import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TerminalView } from '../TerminalView'
import type { TerminalTab } from '../../stores/terminal'

// Mock stores
vi.mock('../../stores/ui', () => ({
  useUIStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ activeView: 'terminal', setView: vi.fn() })
  ),
}))

const shellTab: TerminalTab = {
  id: 'tab-1',
  title: 'Terminal 1',
  kind: 'shell',
  shell: '/bin/zsh',
  ptyId: null,
  isLabelCustom: false,
  status: 'running',
  hasUnread: false,
}

vi.mock('../../stores/terminal', () => ({
  useTerminalStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      tabs: [shellTab],
      activeTabId: 'tab-1',
      showFind: false,
      splitEnabled: false,
      addTab: vi.fn(),
      closeTab: vi.fn(),
      setActiveTab: vi.fn(),
      setShowFind: vi.fn(),
      renameTab: vi.fn(),
      reorderTab: vi.fn(),
      toggleSplit: vi.fn(),
      createAgentTab: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetZoom: vi.fn(),
    }
    return selector ? selector(state) : state
  }),
}))

// Mock heavy child components
vi.mock('../../components/terminal/TerminalPane', () => ({
  TerminalPane: ({ tabId }: { tabId: string }) => (
    <div data-testid={`terminal-pane-${tabId}`} />
  ),
  clearTerminal: vi.fn(),
}))

vi.mock('../../components/terminal/FindBar', () => ({
  FindBar: () => <div data-testid="find-bar" />,
}))

vi.mock('../../components/terminal/AgentOutputTab', () => ({
  AgentOutputTab: ({ agentId }: { agentId: string }) => (
    <div data-testid={`agent-output-${agentId}`} />
  ),
}))

vi.mock('../../components/terminal/ShellPicker', () => ({
  ShellPicker: () => null,
}))

vi.mock('../../components/terminal/AgentPicker', () => ({
  AgentPicker: () => null,
}))

vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Separator: () => <div />,
}))

describe('TerminalView', () => {
  it('renders without crashing', () => {
    const { container } = render(<TerminalView />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders the terminal pane', () => {
    render(<TerminalView />)
    expect(screen.getByTestId('terminal-pane-tab-1')).toBeInTheDocument()
  })

  it('renders the Terminal title', () => {
    render(<TerminalView />)
    expect(screen.getByText('Terminal')).toBeInTheDocument()
  })

  it('renders the tab bar with the initial tab', () => {
    render(<TerminalView />)
    expect(screen.getByText('Terminal 1')).toBeInTheDocument()
  })
})
