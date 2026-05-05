import { useRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type * as Monaco from 'monaco-editor'
import { EditorColumn } from '../EditorColumn'

vi.mock('monaco-editor', () => ({}))
vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value?: string }) => <div data-testid="monaco-editor">{value}</div>,
  loader: { config: vi.fn() }
}))
vi.mock('../../../stores/theme', () => ({
  useThemeStore: vi.fn((selector: (s: { theme: string }) => unknown) => selector({ theme: 'dark' }))
}))
vi.mock('../../../lib/monaco-theme', () => ({
  getMonacoTheme: vi.fn(() => ({ base: 'vs-dark', inherit: true, rules: [], colors: {} })),
  getLightMonacoTheme: vi.fn(() => ({ base: 'vs', inherit: true, rules: [], colors: {} }))
}))
vi.mock('../../../lib/monaco-theme-v2', () => ({
  getMonacoV2Theme: vi.fn(() => ({ base: 'vs-dark', inherit: true, rules: [], colors: {} })),
  V2_THEME_DARK: 'fleet-v2-dark',
  V2_THEME_LIGHT: 'fleet-v2-light'
}))
vi.mock('../TerminalPanel', () => ({
  TerminalPanel: () => <div data-testid="terminal-panel">terminal</div>
}))

const mockSetActiveTab = vi.fn()

vi.mock('../../../stores/ide', () => ({
  useIDEStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      openTabs: [
        {
          id: 'tab-1',
          filePath: '/project/file.ts',
          displayName: 'file.ts',
          language: 'typescript',
          isDirty: false
        }
      ],
      activeTabId: 'tab-1',
      setActiveTab: mockSetActiveTab,
      rootPath: '/project',
      minimapEnabled: true,
      wordWrapEnabled: false,
      fontSize: 13
    })
  )
}))

vi.mock('../../../stores/ideFileCache', () => ({
  useIDEFileCache: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      fileContents: { '/project/file.ts': 'const x = 1' }
    })
  )
}))

const onToggleTerminal = vi.fn()
const onToggleInsight = vi.fn()
const onCloseTab = vi.fn()
const onNewFile = vi.fn()

function Harness({ terminalOpen = false }: { terminalOpen?: boolean }): React.JSX.Element {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  return (
    <EditorColumn
      terminalOpen={terminalOpen}
      insightOpen={false}
      onToggleTerminal={onToggleTerminal}
      onToggleInsight={onToggleInsight}
      onCloseTab={onCloseTab}
      onNewFile={onNewFile}
      editorRef={editorRef}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EditorColumn', () => {
  it('renders the tab strip, context bar, and editor pane', () => {
    render(<Harness />)
    expect(screen.getByRole('tablist', { name: 'Editor tabs' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /file\.ts/ })).toBeInTheDocument()
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
  })

  it('passes file content into the editor', () => {
    render(<Harness />)
    expect(screen.getByTestId('monaco-editor')).toHaveTextContent('const x = 1')
  })

  it('hides the terminal panel when terminalOpen is false', () => {
    render(<Harness terminalOpen={false} />)
    expect(screen.queryByTestId('terminal-panel')).not.toBeInTheDocument()
  })

  it('renders the terminal panel when terminalOpen is true', () => {
    render(<Harness terminalOpen={true} />)
    expect(screen.getByTestId('terminal-panel')).toBeInTheDocument()
  })

  it('forwards the new-file callback to the tab strip', () => {
    render(<Harness />)
    fireEvent.click(screen.getByLabelText('New File'))
    expect(onNewFile).toHaveBeenCalled()
  })

  it('forwards the close callback when a tab is closed', () => {
    render(<Harness />)
    fireEvent.click(screen.getByLabelText('Close file.ts'))
    expect(onCloseTab).toHaveBeenCalledWith('tab-1', false)
  })

  it('forwards the toggle-terminal callback', () => {
    render(<Harness />)
    fireEvent.click(screen.getByLabelText('Toggle Terminal (⌘J)'))
    expect(onToggleTerminal).toHaveBeenCalled()
  })
})
