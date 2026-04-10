import { useEffect } from 'react'
import { useCostDataStore } from '../stores/costData'
import { usePanelLayoutStore } from '../stores/panelLayout'
import { usePendingReviewStore } from '../stores/pendingReview'
import { useFilterPresets } from '../stores/filterPresets'
import { useKeybindingsStore } from '../stores/keybindings'

/**
 * Handles app initialization — panel layout restoration, cost data loading,
 * pending review state, filter presets, and keybindings.
 * Extracted from App.tsx to reduce file size and group initialization logic.
 */
export function useAppInitialization(): void {
  const fetchLocalAgents = useCostDataStore((s) => s.fetchLocalAgents)
  const loadLayout = usePanelLayoutStore((s) => s.loadSavedLayout)
  const restorePendingReview = usePendingReviewStore((s) => s.restoreFromStorage)
  const restoreFilterPresets = useFilterPresets((s) => s.restoreFromStorage)
  const initKeybindings = useKeybindingsStore((s) => s.init)

  useEffect(() => {
    fetchLocalAgents()
  }, [fetchLocalAgents])

  useEffect(() => {
    initKeybindings()
  }, [initKeybindings])

  useEffect(() => {
    loadLayout()
  }, [loadLayout])

  useEffect(() => {
    restorePendingReview()
  }, [restorePendingReview])

  useEffect(() => {
    restoreFilterPresets()
  }, [restoreFilterPresets])
}
