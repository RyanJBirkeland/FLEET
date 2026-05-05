/**
 * util.ts — Shared utilities for console cards
 */

import {
  Terminal,
  FileText,
  Edit3,
  FilePlus,
  Search,
  Folder,
  Bot,
  List,
  Wrench,
  type LucideIcon
} from 'lucide-react'

export function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return ''
  }
}

export interface ToolMeta {
  Icon: LucideIcon
  color: string
}

export const TOOL_MAP: Record<string, ToolMeta> = {
  bash: { Icon: Terminal, color: 'var(--st-blocked)' },
  read: { Icon: FileText, color: 'var(--st-review)' },
  edit: { Icon: Edit3, color: 'var(--accent)' },
  write: { Icon: FilePlus, color: 'var(--accent)' },
  grep: { Icon: Search, color: 'var(--st-running)' },
  glob: { Icon: Folder, color: 'var(--st-blocked)' },
  agent: { Icon: Bot, color: 'var(--st-done)' },
  task: { Icon: Bot, color: 'var(--st-done)' },
  list: { Icon: List, color: 'var(--fg-2)' }
}

export function getToolMeta(toolName: string): ToolMeta {
  return TOOL_MAP[toolName.toLowerCase()] ?? { Icon: Wrench, color: 'var(--fg-2)' }
}
