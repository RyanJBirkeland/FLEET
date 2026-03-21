export { AgentManager, type AgentManagerConfig, type AgentManagerDeps, type QueuedTask } from './agent-manager'
export { Watchdog } from './watchdog'
export { createWorktree, removeWorktree, getActualBranch, acquireRepoLock, releaseRepoLock } from './worktree-ops'
export { handleAgentCompletion, type CompletionContext } from './completion-handler'
