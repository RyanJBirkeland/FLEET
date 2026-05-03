import { create } from 'zustand'

interface PreflightWarning {
  taskId: string
  repoName: string
  taskTitle: string
  missing: string[]
  missingEnvVars: string[]
}

interface PreflightStore {
  queue: PreflightWarning[]
  enqueue: (warning: PreflightWarning) => void
  dequeue: () => void
}

export const usePreflightStore = create<PreflightStore>((set) => ({
  queue: [],
  enqueue: (warning) => set((s) => ({ queue: [...s.queue, warning] })),
  dequeue: () => set((s) => ({ queue: s.queue.slice(1) }))
}))
