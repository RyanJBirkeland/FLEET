import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextBar } from '../ContextBar'

vi.mock('../../../stores/ide', () => ({
  useIDEStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      openTabs: [
        {
          id: 'tab-1',
          filePath: '/project/src/components/file.ts',
          displayName: 'file.ts',
          language: 'typescript',
          isDirty: false
        }
      ],
      rootPath: '/project'
    })
  )
}))

const onToggleTerminal = vi.fn()
const onToggleInsight = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ContextBar', () => {
  it('renders breadcrumbs relative to the workspace root', () => {
    render(
      <ContextBar
        activeTabId="tab-1"
        terminalOpen={false}
        insightOpen={false}
        onToggleTerminal={onToggleTerminal}
        onToggleInsight={onToggleInsight}
      />
    )
    expect(screen.getByText('src')).toBeInTheDocument()
    expect(screen.getByText('components')).toBeInTheDocument()
    expect(screen.getByText('file.ts')).toBeInTheDocument()
  })

  it('renders no breadcrumbs when no tab is active', () => {
    render(
      <ContextBar
        activeTabId={null}
        terminalOpen={false}
        insightOpen={false}
        onToggleTerminal={onToggleTerminal}
        onToggleInsight={onToggleInsight}
      />
    )
    expect(screen.queryByText('file.ts')).not.toBeInTheDocument()
  })

  it('calls onToggleTerminal when the terminal toggle is clicked', () => {
    render(
      <ContextBar
        activeTabId="tab-1"
        terminalOpen={false}
        insightOpen={false}
        onToggleTerminal={onToggleTerminal}
        onToggleInsight={onToggleInsight}
      />
    )
    fireEvent.click(screen.getByLabelText('Toggle Terminal (⌘J)'))
    expect(onToggleTerminal).toHaveBeenCalled()
  })

  it('calls onToggleInsight when the insight toggle is clicked', () => {
    render(
      <ContextBar
        activeTabId="tab-1"
        terminalOpen={false}
        insightOpen={false}
        onToggleTerminal={onToggleTerminal}
        onToggleInsight={onToggleInsight}
      />
    )
    fireEvent.click(screen.getByLabelText('Toggle Insights (⌘⌥I)'))
    expect(onToggleInsight).toHaveBeenCalled()
  })

  it('reflects active state on the terminal toggle when terminalOpen is true', () => {
    render(
      <ContextBar
        activeTabId="tab-1"
        terminalOpen={true}
        insightOpen={false}
        onToggleTerminal={onToggleTerminal}
        onToggleInsight={onToggleInsight}
      />
    )
    expect(screen.getByLabelText('Toggle Terminal (⌘J)')).toHaveAttribute('aria-pressed', 'true')
  })

  it('exposes Split Editor and Open in Editor stub buttons', () => {
    render(
      <ContextBar
        activeTabId="tab-1"
        terminalOpen={false}
        insightOpen={false}
        onToggleTerminal={onToggleTerminal}
        onToggleInsight={onToggleInsight}
      />
    )
    expect(screen.getByLabelText('Split Editor')).toBeInTheDocument()
    expect(screen.getByLabelText('Open in Editor')).toBeInTheDocument()
  })
})
