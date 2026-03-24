import { create } from 'zustand'
import { toast } from './toasts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitFileEntry {
  path: string
  status: string
}

interface GitTreeState {
  // --- Data ---
  branch: string
  staged: GitFileEntry[]
  unstaged: GitFileEntry[]
  untracked: GitFileEntry[]
  loading: boolean
  selectedFile: GitFileEntry | null
  selectedStaged: boolean
  diffContent: string
  commitMessage: string
  repoPaths: string[]
  activeRepo: string | null
  branches: string[]

  // --- Actions ---
  fetchStatus: (cwd: string) => Promise<void>
  selectFile: (cwd: string, path: string, staged: boolean) => Promise<void>
  clearSelection: () => void
  stageFile: (cwd: string, path: string) => Promise<void>
  unstageFile: (cwd: string, path: string) => Promise<void>
  stageAll: (cwd: string) => Promise<void>
  unstageAll: (cwd: string) => Promise<void>
  setCommitMessage: (msg: string) => void
  commit: (cwd: string) => Promise<void>
  push: (cwd: string) => Promise<void>
  fetchBranches: (cwd: string) => Promise<void>
  setActiveRepo: (path: string) => void
  loadRepoPaths: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseGitStatus(raw: string): {
  staged: GitFileEntry[]
  unstaged: GitFileEntry[]
  untracked: GitFileEntry[]
  branch: string
} {
  const lines = raw.split('\n').filter(Boolean)
  const staged: GitFileEntry[] = []
  const unstaged: GitFileEntry[] = []
  const untracked: GitFileEntry[] = []
  let branch = ''

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // e.g. "## main...origin/main" or "## No commits yet on main"
      const ref = line.slice(3).split('...')[0]
      branch = ref.replace('No commits yet on ', '')
      continue
    }

    if (line.length < 2) continue
    const x = line[0] // index status
    const y = line[1] // worktree status
    const filePath = line.slice(3).trim()

    if (x === '?' && y === '?') {
      untracked.push({ path: filePath, status: '?' })
      continue
    }

    // Staged changes: index column (X) is not space or ?
    if (x !== ' ' && x !== '?') {
      staged.push({ path: filePath, status: x })
    }

    // Unstaged changes: worktree column (Y) is not space or ?
    if (y !== ' ' && y !== '?') {
      unstaged.push({ path: filePath, status: y })
    }
  }

  return { staged, unstaged, untracked, branch }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGitTreeStore = create<GitTreeState>((set, get) => ({
  branch: '',
  staged: [],
  unstaged: [],
  untracked: [],
  loading: false,
  selectedFile: null,
  selectedStaged: false,
  diffContent: '',
  commitMessage: '',
  repoPaths: [],
  activeRepo: null,
  branches: [],

  fetchStatus: async (cwd: string): Promise<void> => {
    set({ loading: true })
    try {
      const raw = await window.api.gitStatus(cwd)
      const { staged, unstaged, untracked, branch } = parseGitStatus(raw ?? '')
      set({ staged, unstaged, untracked, branch, loading: false })
    } catch (err) {
      set({ loading: false })
      toast.error('Failed to fetch git status')
    }
  },

  selectFile: async (cwd: string, path: string, staged: boolean): Promise<void> => {
    const entry = staged
      ? get().staged.find((f) => f.path === path)
      : [...get().unstaged, ...get().untracked].find((f) => f.path === path)

    if (!entry) return

    set({ selectedFile: entry, selectedStaged: staged, diffContent: '' })

    try {
      const diff = await window.api.gitDiff(cwd, path)
      set({ diffContent: diff ?? '' })
    } catch {
      set({ diffContent: '' })
    }
  },

  clearSelection: (): void => {
    set({ selectedFile: null, selectedStaged: false, diffContent: '' })
  },

  stageFile: async (cwd: string, path: string): Promise<void> => {
    try {
      await window.api.gitStage(cwd, [path])
      await get().fetchStatus(cwd)
    } catch {
      toast.error(`Failed to stage ${path}`)
    }
  },

  unstageFile: async (cwd: string, path: string): Promise<void> => {
    try {
      await window.api.gitUnstage(cwd, [path])
      await get().fetchStatus(cwd)
    } catch {
      toast.error(`Failed to unstage ${path}`)
    }
  },

  stageAll: async (cwd: string): Promise<void> => {
    const { unstaged, untracked } = get()
    const paths = [...unstaged, ...untracked].map((f) => f.path)
    if (paths.length === 0) return
    try {
      await window.api.gitStage(cwd, paths)
      await get().fetchStatus(cwd)
    } catch {
      toast.error('Failed to stage all files')
    }
  },

  unstageAll: async (cwd: string): Promise<void> => {
    const { staged } = get()
    const paths = staged.map((f) => f.path)
    if (paths.length === 0) return
    try {
      await window.api.gitUnstage(cwd, paths)
      await get().fetchStatus(cwd)
    } catch {
      toast.error('Failed to unstage all files')
    }
  },

  setCommitMessage: (msg: string): void => {
    set({ commitMessage: msg })
  },

  commit: async (cwd: string): Promise<void> => {
    const { commitMessage, staged } = get()
    if (!commitMessage.trim() || staged.length === 0) return
    try {
      await window.api.gitCommit(cwd, commitMessage)
      set({ commitMessage: '' })
      await get().fetchStatus(cwd)
      toast.success('Committed successfully')
    } catch {
      toast.error('Commit failed')
    }
  },

  push: async (cwd: string): Promise<void> => {
    try {
      await window.api.gitPush(cwd)
      toast.success('Pushed successfully')
    } catch {
      toast.error('Push failed')
    }
  },

  fetchBranches: async (cwd: string): Promise<void> => {
    try {
      const result = await window.api.gitBranches(cwd)
      const branches = Array.isArray(result) ? result : []
      set({ branches })
    } catch {
      set({ branches: [] })
    }
  },

  setActiveRepo: (path: string): void => {
    set({ activeRepo: path })
  },

  loadRepoPaths: async (): Promise<void> => {
    try {
      const paths = await window.api.getRepoPaths()
      const repoPaths = Array.isArray(paths) ? paths : []
      set({ repoPaths })
      if (repoPaths.length > 0 && !get().activeRepo) {
        set({ activeRepo: repoPaths[0] })
      }
    } catch {
      set({ repoPaths: [] })
    }
  },
}))
