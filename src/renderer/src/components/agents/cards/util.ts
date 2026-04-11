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

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

export interface ToolMeta {
  Icon: LucideIcon
  color: string
}

export const TOOL_MAP: Record<string, ToolMeta> = {
  bash: { Icon: Terminal, color: 'var(--bde-warning)' },
  read: { Icon: FileText, color: 'var(--bde-status-review)' },
  edit: { Icon: Edit3, color: 'var(--bde-accent)' },
  write: { Icon: FilePlus, color: 'var(--bde-accent)' },
  grep: { Icon: Search, color: 'var(--bde-status-active)' },
  glob: { Icon: Folder, color: 'var(--bde-warning)' },
  agent: { Icon: Bot, color: 'var(--bde-status-done)' },
  task: { Icon: Bot, color: 'var(--bde-status-done)' },
  list: { Icon: List, color: 'var(--bde-text-muted)' }
}

export function getToolMeta(toolName: string): ToolMeta {
  return TOOL_MAP[toolName.toLowerCase()] ?? { Icon: Wrench, color: 'var(--bde-text-muted)' }
}
