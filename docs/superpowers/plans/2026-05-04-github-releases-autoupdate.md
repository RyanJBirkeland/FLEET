# GitHub Releases + Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire GitHub Releases as FLEET's distribution channel and add in-app auto-update via `electron-updater` with a "Check for Updates" button in Settings → About.

**Architecture:** `electron-builder` publishes signed DMGs to GitHub Releases via `GH_TOKEN`. `electron-updater`'s `autoUpdater` runs in the main process as `UpdaterService`, translating lifecycle events into `broadcast('updates:status', ...)` calls. The renderer's `AboutSection` subscribes via the preload bridge and surfaces a button + status line.

**Tech Stack:** `electron-updater`, Electron IPC (`safeHandle`/`typedInvoke`/`broadcast`/`onBroadcast`), React, existing `BroadcastChannels` + `IpcChannelMap` patterns.

---

## File Map

| File | Change |
|---|---|
| `electron-builder.yml` | Add `publish` block |
| `package.json` | Add `release` script; add `electron-updater` to `dependencies` |
| `src/shared/ipc-channels/broadcast-channels.ts` | Add `updates:status` to `BroadcastChannels` |
| `src/shared/ipc-channels/update-channels.ts` | New — `UpdateChannels` interface |
| `src/shared/ipc-channels/index.ts` | Intersect `UpdateChannels` into `IpcChannelMap` |
| `src/main/services/updater-service.ts` | New — `UpdaterService` class |
| `src/main/handlers/update-handlers.ts` | New — `registerUpdateHandlers` |
| `src/main/index.ts` | Construct `UpdaterService`; call `registerUpdateHandlers` |
| `src/preload/index.ts` | Add `updates` bridge object |
| `src/renderer/src/components/settings/AboutSection.tsx` | Add update button + status line |

---

### Task 1: Install `electron-updater` and configure publishing

**Files:**
- Modify: `package.json`
- Modify: `electron-builder.yml`

- [ ] **Step 1: Install `electron-updater` as a runtime dependency**

```bash
cd /Users/ryanbirkeland/Projects/git-repos/FLEET
npm install electron-updater
```

Expected: `electron-updater` appears in `package.json` `dependencies` (not `devDependencies`).

- [ ] **Step 2: Add the `release` script to `package.json`**

In `package.json`, find the `"scripts"` section. Add after the `"package"` line:

```json
"release": "FLEET_NOTARIZE=1 npm run package -- --publish always",
```

- [ ] **Step 3: Add publish config to `electron-builder.yml`**

Append to the end of `electron-builder.yml`:

```yaml
publish:
  provider: github
  owner: RyanJBirkeland
  repo: FLEET
```

- [ ] **Step 4: Verify the build config loads correctly**

```bash
npx electron-builder --help 2>&1 | head -5
```

Expected: no config parsing errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json electron-builder.yml
git commit -m "feat(release): add electron-updater dep and GitHub Releases publish config"
```

---

### Task 2: IPC types — broadcast channel + request/reply channels

**Files:**
- Modify: `src/shared/ipc-channels/broadcast-channels.ts`
- Create: `src/shared/ipc-channels/update-channels.ts`
- Modify: `src/shared/ipc-channels/index.ts`

**Background:** `BroadcastChannels` is the registry of main→renderer push events (no reply). `IpcChannelMap` maps request/reply channels used by `safeHandle` (main) and `typedInvoke` (preload). Both live in `src/shared/ipc-channels/`.

- [ ] **Step 1: Add `updates:status` to `BroadcastChannels`**

In `src/shared/ipc-channels/broadcast-channels.ts`, add inside the `BroadcastChannels` interface before the closing `}`:

```typescript
  // Auto-updater status pushed from main process to renderer
  'updates:status': {
    status: 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error'
    /** New version string — present for status 'available', 'downloading', 'ready'. */
    version?: string | undefined
    /** Download progress 0–100 — present for status 'downloading'. */
    percent?: number | undefined
    /** Human-readable error message — present for status 'error'. */
    error?: string | undefined
  }
```

- [ ] **Step 2: Create `src/shared/ipc-channels/update-channels.ts`**

```typescript
export interface UpdateChannels {
  /** Trigger an immediate update check from the renderer. */
  'updates:checkForUpdates': {
    args: []
    result: void
  }
  /** Quit the app and install the downloaded update. */
  'updates:install': {
    args: []
    result: void
  }
}
```

- [ ] **Step 3: Intersect `UpdateChannels` into `IpcChannelMap`**

In `src/shared/ipc-channels/index.ts`, find the `IpcChannelMap` type (near the bottom). It's a long intersection — add `& import('./update-channels').UpdateChannels` at the end of the type:

```typescript
export type IpcChannelMap = import('./settings-channels').SettingsChannels &
  // ... existing entries ... &
  import('./agent-channels').PreflightChannels &
  import('./update-channels').UpdateChannels
```

- [ ] **Step 4: Run typecheck to confirm no errors**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc-channels/broadcast-channels.ts \
        src/shared/ipc-channels/update-channels.ts \
        src/shared/ipc-channels/index.ts
git commit -m "feat(updates): add updates:status broadcast + IPC channel types"
```

---

### Task 3: `UpdaterService` — main process

**Files:**
- Create: `src/main/services/updater-service.ts`
- Create: `src/main/handlers/update-handlers.ts`
- Modify: `src/main/index.ts`

**Background:** `broadcast` is imported from `'../broadcast'` in main-process files. `is` (from `@electron-toolkit/utils`) provides `is.dev` to detect development mode — skips updates in dev. `safeHandle` is imported from `'../ipc-utils'` in handler files.

- [ ] **Step 1: Create `src/main/services/updater-service.ts`**

```typescript
import { autoUpdater } from 'electron-updater'
import type { Logger } from '../logger'
import { broadcast } from '../broadcast'

const CHECK_DELAY_MS = 30_000

export class UpdaterService {
  private latestVersion: string | null = null

  constructor(private readonly logger: Logger) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.logger = null // suppress electron-updater's default logging

    autoUpdater.on('checking-for-update', () => {
      broadcast('updates:status', { status: 'checking' })
    })

    autoUpdater.on('update-available', (info) => {
      this.latestVersion = info.version
      broadcast('updates:status', { status: 'available', version: info.version })
    })

    autoUpdater.on('download-progress', (p) => {
      broadcast('updates:status', {
        status: 'downloading',
        percent: p.percent,
        version: this.latestVersion ?? undefined
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      broadcast('updates:status', { status: 'ready', version: info.version })
    })

    autoUpdater.on('update-not-available', () => {
      broadcast('updates:status', { status: 'up-to-date' })
    })

    autoUpdater.on('error', (err: Error) => {
      this.logger.error(`[updater] ${err.message}`)
      broadcast('updates:status', { status: 'error', error: err.message })
    })
  }

  checkForUpdates(): void {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      this.logger.error(`[updater] checkForUpdates failed: ${err.message}`)
    })
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall()
  }

  /** Schedules a silent background check 30s after app launch. */
  scheduleInitialCheck(): void {
    setTimeout(() => this.checkForUpdates(), CHECK_DELAY_MS)
  }
}
```

- [ ] **Step 2: Create `src/main/handlers/update-handlers.ts`**

```typescript
import { safeHandle } from '../ipc-utils'
import type { UpdaterService } from '../services/updater-service'

export function registerUpdateHandlers(updaterService: UpdaterService): void {
  safeHandle('updates:checkForUpdates', async () => {
    updaterService.checkForUpdates()
  })

  safeHandle('updates:install', async () => {
    updaterService.quitAndInstall()
  })
}
```

- [ ] **Step 3: Wire into `src/main/index.ts`**

Add the import near the top of `src/main/index.ts` (with the other service imports):
```typescript
import { UpdaterService } from './services/updater-service'
import { registerUpdateHandlers } from './handlers/update-handlers'
```

Find the `app.whenReady().then(async () => {` block (around line 627). Inside it, after `registerAllHandlers(...)` is called, add:

```typescript
  // Auto-updater — skip in dev mode (app.isPackaged is false in dev)
  if (app.isPackaged) {
    const updaterService = new UpdaterService(createLogger('updater'))
    registerUpdateHandlers(updaterService)
    updaterService.scheduleInitialCheck()
  }
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/updater-service.ts \
        src/main/handlers/update-handlers.ts \
        src/main/index.ts
git commit -m "feat(updates): add UpdaterService and register update IPC handlers"
```

---

### Task 4: Preload bridge

**Files:**
- Modify: `src/preload/index.ts`

**Background:** The preload bridge exposes typed wrappers over `ipcRenderer`. `typedInvoke` is used for request/reply. `onBroadcast` wraps `ipcRenderer.on` for push events. Both are imported from `'./ipc-helpers'`. The `api` object is spread into `contextBridge.exposeInMainWorld('api', api)` at the bottom.

- [ ] **Step 1: Add `updates` to the preload bridge**

In `src/preload/index.ts`, add the import for `BroadcastChannels` if not already present. It's already imported via the existing `onBroadcast` usage — just verify.

Find the `const api = {` object definition. Before the closing `}`, add:

```typescript
  // Auto-updater
  updates: {
    checkForUpdates: (): Promise<void> => typedInvoke('updates:checkForUpdates'),
    install: (): Promise<void> => typedInvoke('updates:install'),
    onStatus: onBroadcast<BroadcastChannels['updates:status']>('updates:status')
  },
```

Place it just before the `mcp:` block near the end of the `api` object.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: zero errors. If there are errors about `BroadcastChannels` not being imported, check that `broadcast-channels.ts` is already imported via the existing `onBroadcast` calls — it should be.

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(updates): expose updates bridge in preload (checkForUpdates, install, onStatus)"
```

---

### Task 5: About section UI

**Files:**
- Modify: `src/renderer/src/components/settings/AboutSection.tsx`

**Background:** `AboutSection` currently has a clean row layout (Version, Log Path, Source, Shortcuts). Add a "Check for Updates" button next to the version value, and a status line below. Use `window.api.updates.onStatus` to subscribe — it returns an unsubscribe function. The `Button` component and `SettingsCard` are already imported.

- [ ] **Step 1: Update `AboutSection.tsx`**

Replace the full file content with:

```typescript
/**
 * AboutSection — app version, update check, source link, and API usage stats.
 */
import { useState, useEffect, useRef } from 'react'
import './AboutSection.css'
import { ExternalLink, Keyboard } from 'lucide-react'
import { Button } from '../ui/Button'
import { SettingsCard } from './SettingsCard'
import { CostSection } from './CostSection'

const APP_VERSION = __APP_VERSION__
const GITHUB_URL = 'https://github.com/RyanJBirkeland/FLEET/releases'
const LOG_PATH = '~/.fleet/fleet.log'

type UpdateStatus = {
  status: 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error'
  version?: string | undefined
  percent?: number | undefined
  error?: string | undefined
}

function updateButtonLabel(status: UpdateStatus['status']): string {
  switch (status) {
    case 'checking': return 'Checking…'
    case 'downloading': return 'Downloading…'
    case 'ready': return 'Restart to Update'
    default: return 'Check for Updates'
  }
}

function updateStatusText(update: UpdateStatus | null): string | null {
  if (!update) return null
  switch (update.status) {
    case 'checking': return null
    case 'up-to-date': return "You're up to date."
    case 'available': return `v${update.version ?? ''} available — downloading…`
    case 'downloading': return `Downloading… ${Math.round(update.percent ?? 0)}%`
    case 'ready': return `v${update.version ?? ''} ready to install. Restart to apply.`
    case 'error': return `Update check failed: ${update.error ?? 'unknown error'}`
    default: return null
  }
}

export function AboutSection(): React.JSX.Element {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsub = window.api.updates.onStatus((payload) => {
      setUpdateStatus(payload)
      // Auto-clear "up-to-date" after 4 seconds
      if (payload.status === 'up-to-date') {
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
        clearTimerRef.current = setTimeout(() => setUpdateStatus(null), 4000)
      }
    })
    return () => {
      unsub()
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current)
    }
  }, [])

  const handleShowShortcuts = (): void => {
    window.dispatchEvent(new CustomEvent('fleet:show-shortcuts'))
  }

  const handleUpdateClick = (): void => {
    if (updateStatus?.status === 'ready') {
      void window.api.updates.install()
    } else {
      void window.api.updates.checkForUpdates()
    }
  }

  const isUpdateBusy = updateStatus?.status === 'checking' || updateStatus?.status === 'downloading'
  const buttonLabel = updateStatus ? updateButtonLabel(updateStatus.status) : 'Check for Updates'
  const statusText = updateStatusText(updateStatus)

  return (
    <section className="settings-section">
      <h2 className="settings-section__title fleet-section-title">About</h2>
      <SettingsCard title="About FLEET">
        <div className="settings-about">
          <div className="settings-about__row">
            <span className="settings-about__label">Version</span>
            <span className="settings-about__value">{APP_VERSION}</span>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={isUpdateBusy}
              onClick={handleUpdateClick}
              className="settings-about__update-btn"
            >
              {buttonLabel}
            </Button>
          </div>
          {statusText && (
            <div
              className={`settings-about__update-status${updateStatus?.status === 'error' ? ' settings-about__update-status--error' : ''}`}
            >
              {statusText}
            </div>
          )}
          <div className="settings-about__row">
            <span className="settings-about__label">Log Path</span>
            <span className="settings-about__value">{LOG_PATH}</span>
          </div>
          <div className="settings-about__row">
            <span className="settings-about__label">Source</span>
            <Button
              variant="ghost"
              size="sm"
              className="settings-about__link"
              onClick={() => window.api.window.openExternal(GITHUB_URL)}
              type="button"
            >
              GitHub <ExternalLink size={12} />
            </Button>
          </div>
          <div className="settings-about__row">
            <span className="settings-about__label">Shortcuts</span>
            <Button
              variant="ghost"
              size="sm"
              className="settings-about__link"
              onClick={handleShowShortcuts}
              type="button"
            >
              Keyboard Shortcuts <Keyboard size={12} />
            </Button>
          </div>
        </div>
      </SettingsCard>

      <CostSection />
    </section>
  )
}
```

- [ ] **Step 2: Add CSS for the new elements**

In `src/renderer/src/components/settings/AboutSection.css`, append:

```css
.settings-about__update-btn {
  margin-left: auto;
  flex-shrink: 0;
}

.settings-about__update-status {
  font-size: var(--fleet-size-xs, 11px);
  color: var(--fleet-text-muted, rgba(255, 255, 255, 0.55));
  padding: 0 0 4px;
}

.settings-about__update-status--error {
  color: var(--fleet-danger, #ff5555);
}
```

- [ ] **Step 3: Run typecheck + full test suite**

```bash
npm run typecheck && npm test -- --run
```

Expected: zero type errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/settings/AboutSection.tsx \
        src/renderer/src/components/settings/AboutSection.css
git commit -m "feat(updates): add Check for Updates button and status to About section"
```

---

## Self-Review

**Spec coverage:**
- ✅ `publish` block in `electron-builder.yml` (Task 1)
- ✅ `release` script in `package.json` (Task 1)
- ✅ `electron-updater` in `dependencies` (Task 1)
- ✅ `updates:status` in `BroadcastChannels` with all fields (Task 2)
- ✅ `UpdateChannels` interface with `checkForUpdates` + `install` (Task 2)
- ✅ Intersected into `IpcChannelMap` (Task 2)
- ✅ `UpdaterService` with all 5 autoUpdater event listeners (Task 3)
- ✅ `scheduleInitialCheck` with 30s delay (Task 3)
- ✅ Skips updater in dev mode via `app.isPackaged` (Task 3)
- ✅ `registerUpdateHandlers` with both channels (Task 3)
- ✅ `updates` bridge in preload (`checkForUpdates`, `install`, `onStatus`) (Task 4)
- ✅ About section: button with status-aware label (Task 5)
- ✅ Auto-clears "up-to-date" after 4s (Task 5)
- ✅ Error text in red (Task 5)
- ✅ Disabled during checking/downloading (Task 5)

**Type consistency:** `UpdateStatus` type in `AboutSection.tsx` mirrors `BroadcastChannels['updates:status']` exactly. `updateButtonLabel` and `updateStatusText` handle all 6 status values. `onBroadcast<BroadcastChannels['updates:status']>` in preload types correctly.
