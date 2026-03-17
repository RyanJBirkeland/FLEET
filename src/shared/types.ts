/**
 * Shared types used across main, preload, and renderer processes.
 * Single source of truth — do not redefine these elsewhere.
 */

export interface AgentMeta {
  id: string
  pid: number | null
  bin: string
  model: string
  repo: string
  repoPath: string
  task: string
  startedAt: string
  finishedAt: string | null
  exitCode: number | null
  status: 'running' | 'done' | 'failed' | 'unknown'
  logPath: string
  source: 'bde' | 'openclaw' | 'external'
}

export interface SpawnLocalAgentArgs {
  task: string
  repoPath: string
  model?: string
}

export interface SpawnLocalAgentResult {
  pid: number
  logPath: string
  id: string
  interactive: boolean
}

/** A file attachment queued for sending with a chat message. */
export interface Attachment {
  path: string
  name: string
  type: 'image' | 'text'
  /** base64 data URL for image thumbnails / inline rendering */
  preview?: string
  /** Raw base64 data (no data-url prefix) for images */
  data?: string
  /** MIME type for images (e.g. image/png) */
  mimeType?: string
  /** Text content for text files */
  content?: string
}
