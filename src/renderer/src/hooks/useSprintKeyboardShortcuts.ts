/**
 * useSprintKeyboardShortcuts — keyboard shortcuts for the Sprint Center view.
 * N -> open task workbench, Escape -> close drawers.
 */
import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { useSprintUI } from '../stores/sprintUI'

interface UseSprintKeyboardShortcutsArgs {
  openWorkbench: () => void
  setConflictDrawerOpen: Dispatch<SetStateAction<boolean>>
}

export function useSprintKeyboardShortcuts({
  openWorkbench,
  setConflictDrawerOpen
}: UseSprintKeyboardShortcutsArgs): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const state = useSprintUI.getState()

        // If spec panel is open, let SpecPanel handle Escape (unsaved-changes guard)
        if (state.specPanelOpen) return

        // If drawer open or task selected → close drawer + deselect
        if (state.drawerOpen || state.selectedTaskId) {
          state.setSelectedTaskId(null)
          state.setDrawerOpen(false)
          return
        }

        // Otherwise → close log/conflict/health drawers
        state.setLogDrawerTaskId(null)
        setConflictDrawerOpen(false)
        state.setHealthCheckDrawerOpen(false)
        return
      }

      if (
        e.key === 'n' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT' &&
        !(document.activeElement as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault()
        openWorkbench()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [openWorkbench, setConflictDrawerOpen])
}
