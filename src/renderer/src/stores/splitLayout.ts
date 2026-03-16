import { create } from 'zustand'

export type SplitMode = 'single' | '2-pane' | 'grid-4'

interface SplitLayoutState {
  splitMode: SplitMode
  splitPanes: [string | null, string | null, string | null, string | null]
  focusedPaneIndex: number
  setSplitMode: (mode: SplitMode) => void
  setPaneSession: (index: number, key: string | null) => void
  setFocusedPane: (index: number) => void
}

export const useSplitLayoutStore = create<SplitLayoutState>((set, get) => ({
  splitMode: 'single',
  splitPanes: [null, null, null, null],
  focusedPaneIndex: 0,

  setSplitMode: (mode): void => {
    const { splitPanes } = get()
    if (mode === 'single') {
      const panes: [string | null, string | null, string | null, string | null] = [
        splitPanes[0],
        null,
        null,
        null
      ]
      set({ splitMode: mode, splitPanes: panes, focusedPaneIndex: 0 })
    } else {
      set({ splitMode: mode })
    }
  },

  setPaneSession: (index, key): void => {
    const panes = [...get().splitPanes] as [string | null, string | null, string | null, string | null]
    panes[index] = key
    set({ splitPanes: panes })
  },

  setFocusedPane: (index): void => {
    set({ focusedPaneIndex: index })
  }
}))
