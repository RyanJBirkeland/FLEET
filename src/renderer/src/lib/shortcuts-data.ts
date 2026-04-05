/**
 * Keyboard shortcuts data for the shortcuts overlay.
 * Organized by category: Global, IDE, Code Review.
 */

export interface Shortcut {
  keys: string
  description: string
}

export interface ShortcutCategory {
  name: string
  shortcuts: Shortcut[]
}

export const GLOBAL_SHORTCUTS: Shortcut[] = [
  { keys: '\u23181\u20137', description: 'Switch views' },
  { keys: '\u2318P', description: 'Command palette' },
  { keys: '\u2318R', description: 'Refresh current view' },
  { keys: 'Escape', description: 'Close panel / blur input' },
  { keys: '?', description: 'Show shortcuts' },
  { keys: '\u2191 / \u2193', description: 'Navigate list items' },
  { keys: 'Enter', description: 'Select / open item' },
  { keys: 'PageUp / Down', description: 'Scroll chat thread' },
  { keys: 'End', description: 'Jump to latest message' }
]

export const IDE_SHORTCUTS: Shortcut[] = [
  { keys: '\u2318B', description: 'Toggle sidebar' },
  { keys: '\u2318J', description: 'Toggle terminal' },
  { keys: '\u2318O', description: 'Open folder' },
  { keys: '\u2318S', description: 'Save file' },
  { keys: '\u2318W', description: 'Close tab' },
  { keys: '\u2318T', description: 'New terminal tab' },
  { keys: '\u2318F', description: 'Find in terminal' },
  { keys: '\u2318\u21e7D', description: 'Split terminal' },
  { keys: '\u2318\u21e7[ / ]', description: 'Prev/next terminal tab' },
  { keys: '\u2318+/-/0', description: 'Terminal zoom' },
  { keys: '\u2303L', description: 'Clear terminal' },
  { keys: '\u2318/', description: 'Show IDE shortcuts' }
]

export const CODE_REVIEW_SHORTCUTS: Shortcut[] = [
  { keys: 'j / k', description: 'Next / prev task' },
  { keys: '[ / ]', description: 'Prev / next diff file' }
]

export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  { name: 'Global', shortcuts: GLOBAL_SHORTCUTS },
  { name: 'IDE', shortcuts: IDE_SHORTCUTS },
  { name: 'Code Review', shortcuts: CODE_REVIEW_SHORTCUTS }
]
