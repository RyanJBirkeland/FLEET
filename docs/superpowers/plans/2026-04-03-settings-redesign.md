# Settings View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Settings from flat 10-tab horizontal bar to categorized left sidebar with card-based content panels.

**Architecture:** Grouped sidebar (4 categories, 9 sections) with shared `SettingsCard` component. New `settings-v2-neon.css` replaces old neon file. Each section migrated individually into card pattern. Visual refresh only — no IPC or store changes.

**Tech Stack:** React, TypeScript, Zustand, Lucide icons, framer-motion, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-04-03-settings-redesign-design.md`

---

## File Map

### New files

- `src/renderer/src/components/settings/SettingsSidebar.tsx` — sidebar nav with category groups
- `src/renderer/src/components/settings/SettingsCard.tsx` — shared card wrapper
- `src/renderer/src/components/settings/SettingsPageHeader.tsx` — section title + subtitle
- `src/renderer/src/components/settings/StatusPill.tsx` — status indicator component
- `src/renderer/src/assets/settings-v2-neon.css` — replacement neon CSS
- `src/renderer/src/components/settings/__tests__/SettingsSidebar.test.tsx`
- `src/renderer/src/components/settings/__tests__/SettingsCard.test.tsx`
- `src/renderer/src/components/settings/__tests__/StatusPill.test.tsx`

### Modified files

- `src/renderer/src/views/SettingsView.tsx` — sidebar layout replaces tab bar
- `src/renderer/src/views/__tests__/SettingsView.test.tsx` — update nav assertions
- `src/renderer/src/components/settings/ConnectionsSection.tsx` — wrap in SettingsCard
- `src/renderer/src/components/settings/AgentPermissionsSection.tsx` — wrap in SettingsCard
- `src/renderer/src/components/settings/RepositoriesSection.tsx` — wrap in SettingsCard
- `src/renderer/src/components/settings/TaskTemplatesSection.tsx` — wrap in SettingsCard
- `src/renderer/src/components/settings/AgentManagerSection.tsx` — wrap in SettingsCard
- `src/renderer/src/components/settings/CostSection.tsx` — wrap in SettingsCard, wide variant
- `src/renderer/src/components/settings/AppearanceSection.tsx` — wrap in SettingsCard
- `src/renderer/src/components/settings/MemorySection.tsx` — wrap in SettingsCard, wide variant
- `src/renderer/src/components/settings/AboutSection.tsx` — wrap in SettingsCard
- `src/renderer/src/assets/main.css` — swap CSS import

### Deleted files

- `src/renderer/src/components/settings/AgentRuntimeSection.tsx` — deprecated stub
- `src/renderer/src/assets/settings-neon.css` — replaced by v2

---

### Task 1: Shared Components — SettingsCard, StatusPill, SettingsPageHeader

**Files:**

- Create: `src/renderer/src/components/settings/SettingsCard.tsx`
- Create: `src/renderer/src/components/settings/StatusPill.tsx`
- Create: `src/renderer/src/components/settings/SettingsPageHeader.tsx`
- Create: `src/renderer/src/components/settings/__tests__/SettingsCard.test.tsx`
- Create: `src/renderer/src/components/settings/__tests__/StatusPill.test.tsx`

- [ ] **Step 1: Write SettingsCard test**

```tsx
// __tests__/SettingsCard.test.tsx
import { render, screen } from '@testing-library/react'
import { SettingsCard } from '../SettingsCard'

describe('SettingsCard', () => {
  it('renders title and children', () => {
    render(
      <SettingsCard title="Test Card">
        <p>Content</p>
      </SettingsCard>
    )
    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(
      <SettingsCard title="Card" subtitle="Description">
        <p>Body</p>
      </SettingsCard>
    )
    expect(screen.getByText('Description')).toBeInTheDocument()
  })

  it('renders status pill when provided', () => {
    render(
      <SettingsCard title="Card" status={{ label: 'Connected', variant: 'success' }}>
        <p>Body</p>
      </SettingsCard>
    )
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    render(
      <SettingsCard title="Card" footer={<button>Save</button>}>
        <p>Body</p>
      </SettingsCard>
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(
      <SettingsCard title="Card" icon={<span data-testid="icon">C</span>}>
        <p>Body</p>
      </SettingsCard>
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('applies fullBleed class when noPadding is true', () => {
    const { container } = render(
      <SettingsCard title="Card" noPadding>
        <p>Body</p>
      </SettingsCard>
    )
    expect(container.querySelector('.stg-card--full-bleed')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/settings/__tests__/SettingsCard.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SettingsCard**

```tsx
// SettingsCard.tsx
import type { ReactNode } from 'react'
import { StatusPill, type StatusVariant } from './StatusPill'

interface SettingsCardProps {
  icon?: ReactNode
  title: string
  subtitle?: string
  status?: { label: string; variant: StatusVariant }
  children: ReactNode
  footer?: ReactNode
  noPadding?: boolean
}

export function SettingsCard({
  icon,
  title,
  subtitle,
  status,
  children,
  footer,
  noPadding
}: SettingsCardProps): React.JSX.Element {
  return (
    <div className={`stg-card${noPadding ? ' stg-card--full-bleed' : ''}`}>
      <div className="stg-card__header">
        <div className="stg-card__header-left">
          {icon && <div className="stg-card__icon">{icon}</div>}
          <div>
            <div className="stg-card__title">{title}</div>
            {subtitle && <div className="stg-card__subtitle">{subtitle}</div>}
          </div>
        </div>
        {status && <StatusPill label={status.label} variant={status.variant} />}
      </div>
      <div className="stg-card__body">{children}</div>
      {footer && <div className="stg-card__footer">{footer}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Write StatusPill test**

```tsx
// __tests__/StatusPill.test.tsx
import { render, screen } from '@testing-library/react'
import { StatusPill } from '../StatusPill'

describe('StatusPill', () => {
  it('renders label text', () => {
    render(<StatusPill label="Connected" variant="success" />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('applies variant class', () => {
    const { container } = render(<StatusPill label="Error" variant="error" />)
    expect(container.querySelector('.stg-status-pill--error')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Implement StatusPill**

```tsx
// StatusPill.tsx
export type StatusVariant = 'success' | 'info' | 'warning' | 'neutral' | 'error'

interface StatusPillProps {
  label: string
  variant: StatusVariant
}

export function StatusPill({ label, variant }: StatusPillProps): React.JSX.Element {
  return (
    <span className={`stg-status-pill stg-status-pill--${variant}`}>
      {variant === 'success' && <span className="stg-status-pill__dot" />}
      {label}
    </span>
  )
}
```

- [ ] **Step 6: Implement SettingsPageHeader**

```tsx
// SettingsPageHeader.tsx
interface SettingsPageHeaderProps {
  title: string
  subtitle: string
}

export function SettingsPageHeader({
  title,
  subtitle
}: SettingsPageHeaderProps): React.JSX.Element {
  return (
    <div className="stg-page-header">
      <h2 className="stg-page-header__title">{title}</h2>
      <p className="stg-page-header__subtitle">{subtitle}</p>
    </div>
  )
}
```

- [ ] **Step 7: Run all tests**

Run: `npx vitest run src/renderer/src/components/settings/__tests__/SettingsCard.test.tsx src/renderer/src/components/settings/__tests__/StatusPill.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/settings/SettingsCard.tsx src/renderer/src/components/settings/StatusPill.tsx src/renderer/src/components/settings/SettingsPageHeader.tsx src/renderer/src/components/settings/__tests__/SettingsCard.test.tsx src/renderer/src/components/settings/__tests__/StatusPill.test.tsx
git commit -m "feat(settings): add SettingsCard, StatusPill, SettingsPageHeader shared components"
```

---

### Task 2: CSS — settings-v2-neon.css

**Files:**

- Create: `src/renderer/src/assets/settings-v2-neon.css`

- [ ] **Step 1: Write the full CSS file**

Write `settings-v2-neon.css` with all `.stg-*` BEM classes:

- `.stg-layout` — flex row, full height
- `.stg-sidebar` — 200px width, border-right, padding, background `var(--bde-bg-elevated)`
- `.stg-sidebar__category` — uppercase 9px label, purple at 60% opacity, letter-spacing
- `.stg-sidebar__item` — 12px, flex with gap for icon + label, 7px vertical padding, 6px radius
- `.stg-sidebar__item--active` — purple surface background, purple text
- `.stg-sidebar__item:hover` — surface background
- `.stg-sidebar__item:focus-visible` — outline with `var(--bde-accent)`
- `.stg-content` — flex: 1, padding: 28px 36px, overflow-y: auto
- `.stg-content__inner` — max-width: 560px
- `.stg-content__inner--wide` — no max-width
- `.stg-page-header` — margin-bottom 24px
- `.stg-page-header__title` — 18px semibold white
- `.stg-page-header__subtitle` — 12px text-muted
- `.stg-card` — surface background, border, 10px radius, 18px padding, 12px margin-bottom
- `.stg-card--full-bleed` — padding: 0
- `.stg-card__header` — flex between, align start, margin-bottom 14px
- `.stg-card__header-left` — flex, gap 12px, align center
- `.stg-card__icon` — 36x36, border-radius 8px, flex center
- `.stg-card__title` — 13px semibold
- `.stg-card__subtitle` — 11px text-muted, margin-top 2px
- `.stg-card__body` — card content area
- `.stg-card__footer` — top border, padding-top 12px, flex end, gap 8px
- `.stg-status-pill` — inline-flex, padding 3px 10px, border-radius 20px, 11px font-weight 500
- `.stg-status-pill--success` — green color/bg
- `.stg-status-pill--info` — purple color/bg
- `.stg-status-pill--neutral` — muted color/bg
- `.stg-status-pill--error` — danger color/bg
- `.stg-status-pill__dot` — 6px green circle before label
- `.stg-field` — margin-bottom 12px
- `.stg-field__label` — 10px uppercase, text-muted, letter-spacing, margin-bottom 6px
- `.stg-field__input` — full width, surface bg, border, 6px radius, 8px 12px padding, monospace
- `.stg-field__input:focus-visible` — accent outline

All colors MUST use `var(--neon-*)` or `var(--bde-*)` tokens. Zero hardcoded values.

- [ ] **Step 2: Verify CSS has no hardcoded colors**

Run: `grep -n "rgba\|#[0-9a-fA-F]" src/renderer/src/assets/settings-v2-neon.css`
Expected: zero matches

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/assets/settings-v2-neon.css
git commit -m "feat(settings): add settings-v2-neon.css with stg-* BEM classes"
```

---

### Task 3: SettingsSidebar Component

**Files:**

- Create: `src/renderer/src/components/settings/SettingsSidebar.tsx`
- Create: `src/renderer/src/components/settings/__tests__/SettingsSidebar.test.tsx`

- [ ] **Step 1: Write SettingsSidebar test**

```tsx
// __tests__/SettingsSidebar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsSidebar, type SettingsSection } from '../SettingsSidebar'

import { Link, Shield, GitFork } from 'lucide-react'

const SECTIONS: SettingsSection[] = [
  { id: 'connections', label: 'Connections', icon: Link, category: 'Account' },
  { id: 'permissions', label: 'Permissions', icon: Shield, category: 'Account' },
  { id: 'repositories', label: 'Repositories', icon: GitFork, category: 'Projects' }
]

describe('SettingsSidebar', () => {
  it('renders category headers', () => {
    render(<SettingsSidebar sections={SECTIONS} activeId="connections" onSelect={vi.fn()} />)
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
  })

  it('renders all section items', () => {
    render(<SettingsSidebar sections={SECTIONS} activeId="connections" onSelect={vi.fn()} />)
    expect(screen.getByText('Connections')).toBeInTheDocument()
    expect(screen.getByText('Permissions')).toBeInTheDocument()
    expect(screen.getByText('Repositories')).toBeInTheDocument()
  })

  it('marks active item with aria-current', () => {
    render(<SettingsSidebar sections={SECTIONS} activeId="connections" onSelect={vi.fn()} />)
    const active = screen.getByText('Connections').closest('[role="link"]')
    expect(active).toHaveAttribute('aria-current', 'page')
  })

  it('calls onSelect when item clicked', () => {
    const onSelect = vi.fn()
    render(<SettingsSidebar sections={SECTIONS} activeId="connections" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Permissions'))
    expect(onSelect).toHaveBeenCalledWith('permissions')
  })

  it('supports ArrowDown keyboard navigation', () => {
    const onSelect = vi.fn()
    render(<SettingsSidebar sections={SECTIONS} activeId="connections" onSelect={onSelect} />)
    const firstItem = screen.getByText('Connections').closest('[role="link"]')!
    fireEvent.keyDown(firstItem, { key: 'ArrowDown' })
    expect(onSelect).toHaveBeenCalledWith('permissions')
  })

  it('navigates across category boundaries with ArrowDown', () => {
    const onSelect = vi.fn()
    render(<SettingsSidebar sections={SECTIONS} activeId="permissions" onSelect={onSelect} />)
    const item = screen.getByText('Permissions').closest('[role="link"]')!
    fireEvent.keyDown(item, { key: 'ArrowDown' })
    expect(onSelect).toHaveBeenCalledWith('repositories')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/renderer/src/components/settings/__tests__/SettingsSidebar.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement SettingsSidebar**

```tsx
// SettingsSidebar.tsx
import { useRef, useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface SettingsSection {
  id: string
  label: string
  icon: LucideIcon
  category: string
}

interface SettingsSidebarProps {
  sections: SettingsSection[]
  activeId: string
  onSelect: (id: string) => void
}

export function SettingsSidebar({
  sections,
  activeId,
  onSelect
}: SettingsSidebarProps): React.JSX.Element {
  const navRef = useRef<HTMLElement>(null)
  const activeIndex = sections.findIndex((s) => s.id === activeId)

  // Custom keyboard nav that works across category boundaries
  // (useRovingTabIndex relies on parentElement.children which breaks with nested groups)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let nextIndex = activeIndex
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        nextIndex = (activeIndex + 1) % sections.length
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        nextIndex = (activeIndex - 1 + sections.length) % sections.length
      } else if (e.key === 'Home') {
        e.preventDefault()
        nextIndex = 0
      } else if (e.key === 'End') {
        e.preventDefault()
        nextIndex = sections.length - 1
      } else if (e.key === 'Enter') {
        return // already handled by click
      } else {
        return
      }
      onSelect(sections[nextIndex].id)
      // Focus across category boundaries using querySelectorAll
      const items = navRef.current?.querySelectorAll<HTMLElement>('[role="link"]')
      items?.[nextIndex]?.focus()
    },
    [activeIndex, sections, onSelect]
  )

  // Group sections by category, preserving order
  const categories: { name: string; items: (SettingsSection & { globalIndex: number })[] }[] = []
  let currentCat = ''
  sections.forEach((s, i) => {
    if (s.category !== currentCat) {
      currentCat = s.category
      categories.push({ name: s.category, items: [] })
    }
    categories[categories.length - 1].items.push({ ...s, globalIndex: i })
  })

  return (
    <nav ref={navRef} className="stg-sidebar" role="navigation" aria-label="Settings sections">
      {categories.map((cat) => (
        <div key={cat.name} className="stg-sidebar__group">
          <div className="stg-sidebar__category">{cat.name}</div>
          {cat.items.map((section) => {
            const Icon = section.icon
            const isActive = section.id === activeId
            return (
              <div
                key={section.id}
                className={`stg-sidebar__item${isActive ? ' stg-sidebar__item--active' : ''}`}
                role="link"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(section.id)}
                tabIndex={isActive ? 0 : -1}
                onKeyDown={handleKeyDown}
              >
                <Icon size={14} />
                <span>{section.label}</span>
              </div>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/renderer/src/components/settings/__tests__/SettingsSidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/settings/SettingsSidebar.tsx src/renderer/src/components/settings/__tests__/SettingsSidebar.test.tsx
git commit -m "feat(settings): add SettingsSidebar with categorized nav + keyboard support"
```

---

### Task 4: SettingsView — Replace Tab Bar with Sidebar Layout

**Files:**

- Modify: `src/renderer/src/views/SettingsView.tsx`
- Modify: `src/renderer/src/assets/main.css` (swap CSS import)
- Modify: `src/renderer/src/views/__tests__/SettingsView.test.tsx`

- [ ] **Step 1: Update SettingsView.tsx**

Replace the entire `SettingsView` with the new sidebar layout:

- Import `SettingsSidebar` and `SettingsPageHeader`
- Define `SECTIONS` array with id, label, icon, category for all 9 sections (drop 'agent')
- Define `SECTION_META` with title + subtitle per section, and `wide: boolean` flag for Cost/Memory
- Layout: `stg-layout` wrapper → `SettingsSidebar` + `stg-content` → `stg-content__inner` (or `--wide`) → `SettingsPageHeader` + `ActiveSection`
- Keep `framer-motion` wrapper on content area
- Add `aria-live="polite"` region for section changes

Reference existing file at `src/renderer/src/views/SettingsView.tsx` for current structure.

- [ ] **Step 2: Add new CSS import in main.css (keep old one until Task 10)**

In `src/renderer/src/assets/main.css`, add the new import AFTER the existing one (both active during migration):

```css
@import './settings-neon.css';
@import './settings-v2-neon.css';
```

The old `settings-neon.css` keeps existing section styles working while Tasks 5-9 migrate them one by one. Task 10 removes the old import.

- [ ] **Step 3: Update SettingsView tests**

Read existing tests at `src/renderer/src/views/__tests__/SettingsView.test.tsx`. Update:

- Replace `role="tab"` queries with `role="link"` for sidebar items
- Replace `role="tablist"` with `role="navigation"`
- Update keyboard tests: tab bar used ArrowLeft/Right, sidebar uses ArrowUp/Down (both work since hook handles both, but test the primary direction)
- Remove any assertions about the "Agent" tab
- Add test: category headers render ("Account", "Projects", "Pipeline", "App")

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS (all 187+ test files)

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/views/SettingsView.tsx src/renderer/src/views/__tests__/SettingsView.test.tsx src/renderer/src/assets/main.css
git commit -m "feat(settings): replace tab bar with categorized sidebar layout"
```

---

### Task 5: Migrate Sections — Connections + About (simplest first)

**Files:**

- Modify: `src/renderer/src/components/settings/ConnectionsSection.tsx`
- Modify: `src/renderer/src/components/settings/AboutSection.tsx`

- [ ] **Step 1: Migrate ConnectionsSection**

Read existing file. Wrap Claude CLI Auth and GitHub sections in `SettingsCard` components:

- Claude card: `icon={<div className="stg-card__icon stg-card__icon--purple">C</div>}`, `title="Claude CLI Auth"`, `subtitle="OAuth token for agent spawning"`, `status={{ label: authStatus, variant: 'success'|'error' }}`
- GitHub card: similar pattern with CredentialForm in body
- Remove old section wrapper CSS classes, use `stg-card` classes
- Keep all existing IPC calls and state management unchanged

- [ ] **Step 2: Migrate AboutSection**

Wrap in single `SettingsCard` with title="About BDE", version info in body.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/settings/ConnectionsSection.tsx src/renderer/src/components/settings/AboutSection.tsx
git commit -m "feat(settings): migrate Connections + About to SettingsCard pattern"
```

---

### Task 6: Migrate Sections — Repositories + Templates

**Files:**

- Modify: `src/renderer/src/components/settings/RepositoriesSection.tsx`
- Modify: `src/renderer/src/components/settings/TaskTemplatesSection.tsx`

- [ ] **Step 1: Migrate RepositoriesSection**

Each repo as a `SettingsCard` with name, path info, color swatch, Edit/Delete in footer. Add repo form stays inline expand. Empty state with icon + message + Add button.

- [ ] **Step 2: Migrate TaskTemplatesSection**

Each template as a `SettingsCard` with name field + prefix textarea. Add Template button at bottom. Delete via confirm dialog.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/settings/RepositoriesSection.tsx src/renderer/src/components/settings/TaskTemplatesSection.tsx
git commit -m "feat(settings): migrate Repositories + Templates to SettingsCard pattern"
```

---

### Task 7: Migrate Sections — AgentManager + Permissions

**Files:**

- Modify: `src/renderer/src/components/settings/AgentManagerSection.tsx`
- Modify: `src/renderer/src/components/settings/AgentPermissionsSection.tsx`

- [ ] **Step 1: Migrate AgentManagerSection**

Single `SettingsCard` with all form fields. Footer: Save button + "Changes take effect on restart" note.

- [ ] **Step 2: Migrate AgentPermissionsSection**

Keep consent banner. Preset cards as horizontal group. Tool rules in `SettingsCard`. Deny rules in separate `SettingsCard`. This is the most complex section — preserve all existing state and IPC.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/settings/AgentManagerSection.tsx src/renderer/src/components/settings/AgentPermissionsSection.tsx
git commit -m "feat(settings): migrate Agent Manager + Permissions to SettingsCard pattern"
```

---

### Task 8: Migrate Sections — Cost & Usage + Appearance

**Files:**

- Modify: `src/renderer/src/components/settings/CostSection.tsx`
- Modify: `src/renderer/src/components/settings/AppearanceSection.tsx`

- [ ] **Step 1: Migrate CostSection**

This section uses the `--wide` content variant. Keep ClaudeCodePanel summary in a `SettingsCard`. Keep TaskTable in a separate `SettingsCard`. Preserve loading skeletons, empty states, row click navigation, CSV export.

- [ ] **Step 2: Migrate AppearanceSection**

Theme toggles in `SettingsCard`. Accent colors in `SettingsCard`. Tear-off close preference in `SettingsCard`. Preserve `aria-pressed` attributes.

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/settings/CostSection.tsx src/renderer/src/components/settings/AppearanceSection.tsx
git commit -m "feat(settings): migrate Cost & Appearance to SettingsCard pattern"
```

---

### Task 9: Migrate Section — Memory

**Files:**

- Modify: `src/renderer/src/components/settings/MemorySection.tsx`

- [ ] **Step 1: Migrate MemorySection**

This section uses `--wide` variant. Wrap two-pane layout in `SettingsCard` with `noPadding`. Left pane (file list + search) and right pane (editor + save/discard) divide inside the card. Preserve all existing keyboard nav (ArrowUp/Down in file list), Cmd+S scoping, search, New/Refresh.

This is the largest section (477 lines). Focus on wrapping in the card pattern — don't restructure internal logic.

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/MemorySection.tsx
git commit -m "feat(settings): migrate Memory to SettingsCard with two-pane layout"
```

---

### Task 10: Cleanup — Delete Old Files + Final Verification

**Files:**

- Delete: `src/renderer/src/components/settings/AgentRuntimeSection.tsx`
- Delete: `src/renderer/src/assets/settings-neon.css`
- Modify: `src/renderer/src/assets/main.css` (remove old import if not already done)

- [ ] **Step 1: Delete deprecated files + remove old CSS import**

```bash
rm src/renderer/src/components/settings/AgentRuntimeSection.tsx
rm src/renderer/src/assets/settings-neon.css
```

In `src/renderer/src/assets/main.css`, remove the old import line:

```css
@import './settings-neon.css'; /* DELETE THIS LINE */
```

Also verify `settings.css` base classes (`.settings-view`, `.settings-view__header`) don't conflict with new `.stg-layout` classes. If old classes are still applied in SettingsView.tsx, remove them.

Grep for any remaining imports of deleted files:

```bash
grep -rn "AgentRuntimeSection\|settings-neon" src/renderer/src/
```

Remove any stale imports found.

- [ ] **Step 2: Run full verification**

```bash
npm run typecheck
npm test
npm run lint
```

All must pass.

- [ ] **Step 3: Run coverage check**

```bash
npm run test:coverage
```

Verify thresholds still pass. The new shared components have tests from Task 1/3.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(settings): delete AgentRuntimeSection stub + old settings-neon.css"
```

- [ ] **Step 5: Final commit — update CLAUDE.md**

Update CLAUDE.md to note:

- Settings view uses grouped sidebar (not horizontal tabs)
- `settings-v2-neon.css` replaces `settings-neon.css`
- `.stg-*` BEM prefix for settings CSS
- `AgentRuntimeSection` deleted

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for settings redesign"
```
