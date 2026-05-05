import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabStrip } from '../TabStrip'
import type { EditorTab } from '../../../stores/ide'

const tabs: EditorTab[] = [
  {
    id: 'tab-1',
    filePath: '/project/file.ts',
    displayName: 'file.ts',
    language: 'typescript',
    isDirty: false
  },
  {
    id: 'tab-2',
    filePath: '/project/dirty.ts',
    displayName: 'dirty.ts',
    language: 'typescript',
    isDirty: true
  }
]

const onActivate = vi.fn()
const onClose = vi.fn()
const onNewFile = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TabStrip', () => {
  it('renders all open tabs', () => {
    render(<TabStrip tabs={tabs} activeTabId="tab-1" onActivate={onActivate} onClose={onClose} />)
    expect(screen.getByText('file.ts')).toBeInTheDocument()
    expect(screen.getByText('dirty.ts')).toBeInTheDocument()
  })

  it('marks the active tab via aria-selected', () => {
    render(<TabStrip tabs={tabs} activeTabId="tab-1" onActivate={onActivate} onClose={onClose} />)
    const activeTab = screen.getByRole('tab', { selected: true })
    expect(activeTab).toHaveTextContent('file.ts')
  })

  it('shows a dirty indicator on dirty tabs when not hovered', () => {
    render(<TabStrip tabs={tabs} activeTabId="tab-1" onActivate={onActivate} onClose={onClose} />)
    expect(screen.getByLabelText('unsaved changes')).toBeInTheDocument()
  })

  it('calls onActivate when a tab is clicked', () => {
    render(<TabStrip tabs={tabs} activeTabId="tab-1" onActivate={onActivate} onClose={onClose} />)
    fireEvent.click(screen.getByText('dirty.ts'))
    expect(onActivate).toHaveBeenCalledWith('tab-2')
  })

  it('calls onClose with the dirty flag when close button is clicked', () => {
    render(<TabStrip tabs={tabs} activeTabId="tab-1" onActivate={onActivate} onClose={onClose} />)
    // Active tab (clean) shows close glyph by default
    fireEvent.click(screen.getByLabelText('Close file.ts'))
    expect(onClose).toHaveBeenCalledWith('tab-1', false)
  })

  it('calls onClose when middle-clicked', () => {
    render(<TabStrip tabs={tabs} activeTabId="tab-1" onActivate={onActivate} onClose={onClose} />)
    const dirtyTab = screen.getByText('dirty.ts').closest('[role="tab"]')!
    fireEvent(dirtyTab, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }))
    expect(onClose).toHaveBeenCalledWith('tab-2', true)
  })

  it('does not render the new-file button when onNewFile is omitted', () => {
    render(<TabStrip tabs={tabs} activeTabId="tab-1" onActivate={onActivate} onClose={onClose} />)
    expect(screen.queryByLabelText('New File')).not.toBeInTheDocument()
  })

  it('renders the new-file button and calls onNewFile when clicked', () => {
    render(
      <TabStrip
        tabs={tabs}
        activeTabId="tab-1"
        onActivate={onActivate}
        onClose={onClose}
        onNewFile={onNewFile}
      />
    )
    fireEvent.click(screen.getByLabelText('New File'))
    expect(onNewFile).toHaveBeenCalled()
  })

  it('exposes a tablist role', () => {
    render(<TabStrip tabs={tabs} activeTabId="tab-1" onActivate={onActivate} onClose={onClose} />)
    expect(screen.getByRole('tablist', { name: 'Editor tabs' })).toBeInTheDocument()
  })
})
