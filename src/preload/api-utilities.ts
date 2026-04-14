import { ipcRenderer } from 'electron'
import { typedInvoke, onBroadcast } from './ipc-helpers'
import type { GitHubFetchInit } from '../shared/ipc-channels'
import type { BroadcastChannels } from '../shared/ipc-channels/broadcast-channels'
import type {
  TaskTemplate,
  SynthesizeRequest,
  ReviseRequest,
  PartnerMessage
} from '../shared/types'

// Clipboard
export const readClipboardImage = () => typedInvoke('clipboard:readImage')

// Window
export const openExternal = (url: string) => typedInvoke('window:openExternal', url)
export const openPlaygroundInBrowser = (html: string) =>
  typedInvoke('playground:openInBrowser', html)
export const setTitle = (title: string): void => ipcRenderer.send('window:setTitle', title)

// GitHub API proxy
export const github = {
  fetch: (path: string, init?: GitHubFetchInit) => typedInvoke('github:fetch', path, init),
  isConfigured: () => typedInvoke('github:isConfigured')
}

// Cost analytics
export const cost = {
  summary: () => typedInvoke('cost:summary'),
  agentRuns: (limit?: number) => typedInvoke('cost:agentRuns', { limit: limit ?? 20 }),
  getAgentHistory: (args?: { limit?: number; offset?: number }) =>
    typedInvoke('cost:getAgentHistory', args)
}

// PR status polling
export const pollPrStatuses = (prs: { taskId: string; prUrl: string }[]) =>
  typedInvoke('pr:pollStatuses', prs)

// Conflict file detection
export const checkConflictFiles = (input: { owner: string; repo: string; prNumber: number }) =>
  typedInvoke('pr:checkConflictFiles', input)

// Plan import
export const planner = {
  import: (repo: string) => typedInvoke('planner:import', repo)
}

// File system
export const openFileDialog = (opts?: { filters?: { name: string; extensions: string[] }[] }) =>
  typedInvoke('fs:openFileDialog', opts)
export const readFileAsBase64 = (path: string) => typedInvoke('fs:readFileAsBase64', path)
export const readFileAsText = (path: string) => typedInvoke('fs:readFileAsText', path)
export const openDirectoryDialog = () => typedInvoke('fs:openDirectoryDialog')
export const readDir = (dirPath: string) => typedInvoke('fs:readDir', dirPath)
export const readFile = (filePath: string) => typedInvoke('fs:readFile', filePath)
export const writeFile = (filePath: string, content: string) =>
  typedInvoke('fs:writeFile', filePath, content)
export const watchDir = (dirPath: string) => typedInvoke('fs:watchDir', dirPath)
export const unwatchDir = () => typedInvoke('fs:unwatchDir')
export const createFile = (filePath: string) => typedInvoke('fs:createFile', filePath)
export const createDir = (dirPath: string) => typedInvoke('fs:createDir', dirPath)
export const rename = (oldPath: string, newPath: string) =>
  typedInvoke('fs:rename', oldPath, newPath)
export const deletePath = (targetPath: string) => typedInvoke('fs:delete', targetPath)
export const stat = (targetPath: string) => typedInvoke('fs:stat', targetPath)
export const listFiles = (rootPath: string) => typedInvoke('fs:listFiles', rootPath)
export const onDirChanged = onBroadcast<BroadcastChannels['fs:dirChanged']>('fs:dirChanged')

// GitHub error broadcast
export const onGitHubError = onBroadcast<BroadcastChannels['github:error']>('github:error')

// PR list broadcast
export const onPrListUpdated =
  onBroadcast<BroadcastChannels['pr:listUpdated']>('pr:listUpdated')
export const getPrList = () => typedInvoke('pr:getList')
export const refreshPrList = () => typedInvoke('pr:refreshList')

// Sprint DB file-watcher broadcast
export const onExternalSprintChange = onBroadcast<BroadcastChannels['sprint:externalChange']>(
  'sprint:externalChange'
)

// Auth status
export const authStatus = () => typedInvoke('auth:status')

// Template CRUD
export const templates = {
  list: () => typedInvoke('templates:list'),
  save: (template: TaskTemplate) => typedInvoke('templates:save', template),
  delete: (name: string) => typedInvoke('templates:delete', name),
  reset: (name: string) => typedInvoke('templates:reset', name)
}

// Terminal PTY
export const terminal = {
  create: (opts: { cols: number; rows: number; shell?: string }) =>
    typedInvoke('terminal:create', opts),
  write: (id: number, data: string): void => ipcRenderer.send('terminal:write', { id, data }),
  resize: (id: number, cols: number, rows: number) =>
    typedInvoke('terminal:resize', { id, cols, rows }),
  kill: (id: number) => typedInvoke('terminal:kill', id),
  onData: (id: number, cb: (data: string) => void): (() => void) => {
    const listener = (_: unknown, data: string): void => cb(data)
    ipcRenderer.on('terminal:data:' + id, listener)
    return () => ipcRenderer.removeListener('terminal:data:' + id, listener)
  },
  onExit: (id: number, cb: () => void): void => {
    ipcRenderer.once('terminal:exit:' + id, cb)
  }
}

// Dashboard analytics
export const dashboard = {
  completionsPerHour: () => typedInvoke('agent:completionsPerHour'),
  recentEvents: (limit?: number) => typedInvoke('agent:recentEvents', limit),
  dailySuccessRate: (days?: number) => typedInvoke('dashboard:dailySuccessRate', days)
}

// System metrics
export const system = {
  loadAverage: () => typedInvoke('system:loadAverage')
}

// Task Workbench
export const workbench = {
  generateSpec: (input: { title: string; repo: string; templateHint: string }) =>
    typedInvoke('workbench:generateSpec', input),
  checkSpec: (input: { title: string; repo: string; spec: string; specType?: string | null }) =>
    typedInvoke('workbench:checkSpec', input),
  checkOperational: (input: { repo: string }) => typedInvoke('workbench:checkOperational', input),
  researchRepo: (input: { query: string; repo: string }) =>
    typedInvoke('workbench:researchRepo', input),
  chatStream: (input: {
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    formContext: { title: string; repo: string; spec: string }
  }) => typedInvoke('workbench:chatStream', input),
  cancelStream: (streamId: string) => typedInvoke('workbench:cancelStream', streamId),
  extractPlan: (markdown: string) => typedInvoke('workbench:extractPlan', markdown),
  onChatChunk: onBroadcast<BroadcastChannels['workbench:chatChunk']>('workbench:chatChunk')
}

// Tear-off window management
export const tearoff = {
  create: (payload: {
    view: string
    screenX: number
    screenY: number
    sourcePanelId: string
    sourceTabIndex: number
  }) => typedInvoke('tearoff:create', payload),
  closeConfirmed: (payload: { action: 'return' | 'close'; remember: boolean }) =>
    typedInvoke('tearoff:closeConfirmed', payload),
  returnToMain: (windowId: string) => ipcRenderer.send('tearoff:returnToMain', { windowId }),
  onTabRemoved: onBroadcast<{ sourcePanelId: string; sourceTabIndex: number }>(
    'tearoff:tabRemoved'
  ),
  onTabReturned: onBroadcast<{ view: string }>('tearoff:tabReturned'),
  onConfirmClose: onBroadcast<undefined>('tearoff:confirmClose'),
  startCrossWindowDrag: (payload: { windowId: string; viewKey: string }) =>
    typedInvoke('tearoff:startCrossWindowDrag', payload),
  onDragIn: onBroadcast<{ viewKey: string; localX: number; localY: number }>('tearoff:dragIn'),
  onDragMove: onBroadcast<{ localX: number; localY: number }>('tearoff:dragMove'),
  onDragCancel: onBroadcast<undefined>('tearoff:dragCancel'),
  sendDropComplete: (payload: { viewKey: string; targetPanelId: string; zone: string }) =>
    ipcRenderer.send('tearoff:dropComplete', payload),
  onCrossWindowDrop: onBroadcast<{ view: string; targetPanelId: string; zone: string }>(
    'tearoff:crossWindowDrop'
  ),
  onDragDone: onBroadcast<undefined>('tearoff:dragDone'),
  sendDragCancel: () => ipcRenderer.send('tearoff:dragCancelFromRenderer'),
  returnAll: (payload: { windowId: string; views: string[] }) =>
    ipcRenderer.send('tearoff:returnAll', payload),
  viewsChanged: (payload: { windowId: string; views: string[] }) =>
    ipcRenderer.send('tearoff:viewsChanged', payload)
}

// Code Review
export const review = {
  getDiff: (payload: { worktreePath: string; base: string }) =>
    typedInvoke('review:getDiff', payload),
  getCommits: (payload: { worktreePath: string; base: string }) =>
    typedInvoke('review:getCommits', payload),
  getFileDiff: (payload: { worktreePath: string; filePath: string; base: string }) =>
    typedInvoke('review:getFileDiff', payload),
  mergeLocally: (payload: { taskId: string; strategy: 'squash' | 'merge' | 'rebase' }) =>
    typedInvoke('review:mergeLocally', payload),
  createPr: (payload: { taskId: string; title: string; body: string }) =>
    typedInvoke('review:createPr', payload),
  requestRevision: (payload: { taskId: string; feedback: string; mode: 'resume' | 'fresh' }) =>
    typedInvoke('review:requestRevision', payload),
  discard: (payload: { taskId: string }) => typedInvoke('review:discard', payload),
  shipIt: (payload: { taskId: string; strategy: 'squash' | 'merge' | 'rebase' }) =>
    typedInvoke('review:shipIt', payload),
  generateSummary: (payload: { taskId: string }) => typedInvoke('review:generateSummary', payload),
  checkAutoReview: (payload: { taskId: string }) =>
    typedInvoke('review:checkAutoReview', payload),
  rebase: (payload: { taskId: string }) => typedInvoke('review:rebase', payload),
  checkFreshness: (payload: { taskId: string }) => typedInvoke('review:checkFreshness', payload),
  autoReview: (taskId: string, force?: boolean) =>
    typedInvoke('review:autoReview', taskId, force ?? false),
  chatStream: (params: { taskId: string; messages: PartnerMessage[] }) =>
    typedInvoke('review:chatStream', params),
  onChatChunk: onBroadcast<BroadcastChannels['review:chatChunk']>('review:chatChunk'),
  abortChat: (streamId: string) => typedInvoke('review:chatAbort', streamId)
}

// Spec Synthesizer
export const synthesizeSpec = (args: SynthesizeRequest) =>
  typedInvoke('synthesizer:generate', args)
export const reviseSpec = (args: ReviseRequest) => typedInvoke('synthesizer:revise', args)
export const cancelSynthesis = (streamId: string) => typedInvoke('synthesizer:cancel', streamId)
export const onSynthesizerChunk =
  onBroadcast<BroadcastChannels['synthesizer:chunk']>('synthesizer:chunk')

// Repository discovery
export const repoDiscovery = {
  scanLocal: (dirs: string[]) => typedInvoke('repos:scanLocal', dirs),
  listGithub: () => typedInvoke('repos:listGithub'),
  clone: (owner: string, repo: string, destDir: string) =>
    typedInvoke('repos:clone', owner, repo, destDir),
  onCloneProgress: onBroadcast<BroadcastChannels['repos:cloneProgress']>('repos:cloneProgress')
}
