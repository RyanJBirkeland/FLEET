import {
  LayoutDashboard,
  Terminal,
  SquareTerminal,
  GitPullRequest,
  Settings,
  GitCommitHorizontal,
  Workflow,
  Hexagon,
  type LucideIcon
} from 'lucide-react'
import type { View } from './view-types'

// ---------------------------------------------------------------------------
// Single source of truth for view metadata
// ---------------------------------------------------------------------------

export interface ViewMetadata {
  label: string
  description: string
  icon: LucideIcon
  shortcut: string // Display format (e.g., '⌘1')
  shortcutKey: string // Key for keyboard handler (e.g., '1')
  hidden?: true | undefined
}

// The `satisfies` check ensures every View key has a ViewMetadata entry.
// Adding a View to the union without a registry entry is a compile error.
export const VIEW_REGISTRY: Record<View, ViewMetadata> = {
  dashboard: {
    label: 'Dashboard',
    description: 'Overview of task pipeline health and agent metrics',
    icon: LayoutDashboard,
    shortcut: '⌘1',
    shortcutKey: '1'
  },
  agents: {
    label: 'Agents',
    description: 'Spawn and monitor AI agents for adhoc tasks',
    icon: Terminal,
    shortcut: '⌘2',
    shortcutKey: '2'
  },
  ide: {
    label: 'IDE',
    description: 'Integrated code editor with file explorer and terminal',
    icon: SquareTerminal,
    shortcut: '⌘3',
    shortcutKey: '3'
  },
  sprint: {
    label: 'Task Pipeline',
    description: 'Monitor tasks flowing through execution stages',
    icon: Workflow,
    shortcut: '⌘4',
    shortcutKey: '4'
  },
  'code-review': {
    label: 'Code Review',
    description: 'Review agent work before integration',
    icon: GitPullRequest,
    shortcut: '⌘5',
    shortcutKey: '5'
  },
  git: {
    label: 'Source Control',
    description: 'Stage, commit, and push changes across repositories',
    icon: GitCommitHorizontal,
    shortcut: '⌘6',
    shortcutKey: '6'
  },
  settings: {
    label: 'Settings',
    description: 'Configure connections, repositories, and preferences',
    icon: Settings,
    shortcut: '⌘7',
    shortcutKey: '7'
  },
  planner: {
    label: 'Task Planner',
    description: 'Plan and structure multi-task workflows',
    icon: Hexagon,
    shortcut: '⌘8',
    shortcutKey: '8'
  }
} satisfies Record<View, ViewMetadata>

// ---------------------------------------------------------------------------
// Derived constants for backward compatibility
// ---------------------------------------------------------------------------

/**
 * Maps each entry in VIEW_REGISTRY to a derived value without an `as` cast.
 * TypeScript infers `Record<View, V>` correctly because the input is already
 * typed as `Record<View, ViewMetadata>` via `satisfies`.
 */
function mapRegistry<V>(fn: (meta: ViewMetadata) => V): Record<View, V> {
  return Object.fromEntries(
    (Object.keys(VIEW_REGISTRY) as View[]).map((view) => [view, fn(VIEW_REGISTRY[view])])
  ) as Record<View, V>
}

export const VIEW_LABELS: Record<View, string> = mapRegistry((meta) => meta.label)

export const VIEW_ICONS: Record<View, LucideIcon> = mapRegistry((meta) => meta.icon)

export const VIEW_SHORTCUTS: Record<View, string> = mapRegistry((meta) => meta.shortcut)

export const VIEW_SHORTCUT_MAP: Partial<Record<string, View>> = Object.fromEntries(
  (Object.keys(VIEW_REGISTRY) as View[])
    .filter((view) => !VIEW_REGISTRY[view].hidden)
    .map((view) => [VIEW_REGISTRY[view].shortcutKey, view])
)
