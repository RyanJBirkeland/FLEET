export { AgentManager, type AgentManagerConfig, type AgentManagerDeps, type QueuedTask, type TaskPatch, type CompletionInput } from './agent-manager'
export { Watchdog } from './watchdog'
export { createWorktree, removeWorktree, getActualBranch, acquireRepoLock, releaseRepoLock } from './worktree-ops'
export { handleAgentCompletion, defaultVcsOps, type CompletionContext, type VcsOps } from './completion-handler'
