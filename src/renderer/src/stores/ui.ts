import { create } from 'zustand'

export type View = 'agents' | 'terminal' | 'sprint' | 'pr-station' | 'memory' | 'cost' | 'settings'

interface UIStore {
  activeView: View
  setView: (view: View) => void
}

export const useUIStore = create<UIStore>((set) => ({
  activeView: 'agents',
  setView: (view) => set({ activeView: view })
}))
