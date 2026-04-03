/**
 * MemorySection — tests for agent knowledge toggles, active summary, and size banner.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'

// Mock the memory service
vi.mock('../../../services/memory', () => ({
  listFiles: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  search: vi.fn(),
  getActiveFiles: vi.fn(),
  setFileActive: vi.fn()
}))

// Mock panel layout store
vi.mock('../../../stores/panelLayout', () => ({
  usePanelLayoutStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ activeView: 'settings' })
  )
}))

// Mock toasts
vi.mock('../../../stores/toasts', () => ({
  toast: { error: vi.fn(), success: vi.fn() }
}))

import * as memoryService from '../../../services/memory'
import { MemorySection } from '../MemorySection'

const mockFiles = [
  { path: 'MEMORY.md', name: 'MEMORY.md', size: 1024, modifiedAt: Date.now(), active: true },
  {
    path: 'project-notes.md',
    name: 'project-notes.md',
    size: 2048,
    modifiedAt: Date.now(),
    active: false
  },
  {
    path: 'large-file.md',
    name: 'large-file.md',
    size: 30000,
    modifiedAt: Date.now(),
    active: false
  }
]

describe('MemorySection — agent knowledge toggles', () => {
  beforeEach(() => {
    vi.mocked(memoryService.listFiles).mockResolvedValue(mockFiles)
    vi.mocked(memoryService.readFile).mockResolvedValue('# Content')
    vi.mocked(memoryService.getActiveFiles).mockResolvedValue({ 'MEMORY.md': true })
    vi.mocked(memoryService.setFileActive).mockResolvedValue({})
    vi.mocked(memoryService.search).mockResolvedValue([])
  })

  it('renders toggle icon for each file', async () => {
    render(<MemorySection />)
    await waitFor(() => {
      const toggles = screen.getAllByRole('button', { name: /agent knowledge/i })
      // 3 files = 3 toggle buttons
      expect(toggles.length).toBe(3)
    })
  })

  it('clicking toggle calls setFileActive service', async () => {
    vi.mocked(memoryService.setFileActive).mockResolvedValue({
      'MEMORY.md': true,
      'project-notes.md': true
    })

    render(<MemorySection />)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /agent knowledge/i }).length).toBe(3)
    })

    // Click the second toggle (project-notes.md, currently inactive)
    const toggles = screen.getAllByRole('button', { name: /Add to agent knowledge/i })
    fireEvent.click(toggles[0])

    await waitFor(() => {
      expect(memoryService.setFileActive).toHaveBeenCalledWith('project-notes.md', true)
    })
  })

  it('active summary shows correct count', async () => {
    render(<MemorySection />)
    await waitFor(() => {
      const summary = document.querySelector('.memory-sidebar__active-summary')
      expect(summary).not.toBeNull()
      expect(summary!.textContent).toContain('1 file active for agents')
    })
  })

  it('active summary shows plural when multiple files active', async () => {
    vi.mocked(memoryService.getActiveFiles).mockResolvedValue({
      'MEMORY.md': true,
      'project-notes.md': true
    })

    render(<MemorySection />)
    await waitFor(() => {
      const summary = document.querySelector('.memory-sidebar__active-summary')
      expect(summary).not.toBeNull()
      expect(summary!.textContent).toContain('2 files active for agents')
    })
  })

  it('size banner appears when files are active and a file is selected', async () => {
    render(<MemorySection />)

    // Wait for files to load then select one to show editor
    await waitFor(() => {
      expect(screen.getByText('MEMORY.md')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('MEMORY.md'))

    await waitFor(() => {
      const banner = document.querySelector('.memory-editor__size-banner')
      expect(banner).not.toBeNull()
      // 1 file active, MEMORY.md size = 1024 bytes = 1.0 KB
      expect(banner!.textContent).toContain('1 file active')
      expect(banner!.textContent).toContain('1.0 KB total')
    })
  })

  it('size banner shows warning when over 30KB', async () => {
    vi.mocked(memoryService.getActiveFiles).mockResolvedValue({
      'MEMORY.md': true,
      'large-file.md': true
    })

    render(<MemorySection />)

    await waitFor(() => {
      expect(screen.getByText('MEMORY.md')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('MEMORY.md'))

    await waitFor(() => {
      const banner = document.querySelector('.memory-editor__size-banner')
      expect(banner).not.toBeNull()
      // Total = 1024 + 30000 = 31024 bytes > 30720
      expect(banner!.textContent).toContain('Large memory may slow agent responses')
      expect(banner).toHaveClass('memory-editor__size-banner--warn')
    })
  })

  it('does not show active summary when no files are active', async () => {
    vi.mocked(memoryService.getActiveFiles).mockResolvedValue({})

    render(<MemorySection />)
    await waitFor(() => {
      expect(screen.getByText('MEMORY.md')).toBeInTheDocument()
    })

    expect(document.querySelector('.memory-sidebar__active-summary')).toBeNull()
  })
})
