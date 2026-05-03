# Per-Repo Environment Variable Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each configured repo to declare its own environment variables (e.g. `NODE_AUTH_TOKEN`) that are injected into pipeline agent spawns, fixing auth failures on private npm registries.

**Architecture:** `RepoConfig` gains an optional `envVars` field stored in the existing `repos` JSON blob. A new `getRepoEnvVars(slug)` helper reads it. `spawnAndWireAgent` calls that helper and passes the result as `extraEnv` down through `spawnWithTimeout` → `spawnAgent` → `spawnClaudeAgent`, where it is merged on top of the base env. The Settings → Repositories UI gains a per-repo key-value editor.

**Tech Stack:** TypeScript, React, Vitest, existing `window.api.settings` IPC, lucide-react icons.

---

## File Map

| File | What changes |
|---|---|
| `src/main/paths.ts` | Add `envVars?` to `RepoConfig`; add `getRepoEnvVars()` |
| `src/main/__tests__/paths.test.ts` | New `describe('getRepoEnvVars')` block |
| `src/main/agent-manager/sdk-adapter.ts` | Add `extraEnv?` to `spawnClaudeAgent` opts + `spawnAgent` opts + `spawnWithTimeout` param; merge in env build |
| `src/main/agent-manager/spawn-and-wire.ts` | Call `getRepoEnvVars(task.repo)`; pass to `spawnWithTimeout` |
| `src/main/agent-manager/__tests__/sdk-adapter.test.ts` | Two new tests for `extraEnv` merging |
| `src/renderer/src/components/settings/RepositoriesSection.tsx` | Add `envVars?` to local type + expandable key-value editor UI |
| `src/renderer/src/components/settings/RepositoriesSection.css` | Styles for env var editor |
| `src/renderer/src/components/settings/__tests__/RepositoriesSection.test.tsx` | Two new tests for env var editor |
| `docs/modules/lib/main/index.md` | Add `getRepoEnvVars` to `paths.ts` row |

---

### Task 1: `getRepoEnvVars` — data model and helper

**Files:**
- Modify: `src/main/paths.ts`
- Modify: `src/main/__tests__/paths.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/main/__tests__/paths.test.ts` — add the mock at the top of the file (after existing imports, before existing `describe` blocks):

```typescript
vi.mock('../settings', () => ({
  getSettingJson: vi.fn()
}))
import { getSettingJson } from '../settings'
```

Then add this block at the bottom of the file:

```typescript
// ---------------------------------------------------------------------------
// getRepoEnvVars
// ---------------------------------------------------------------------------

describe('getRepoEnvVars', () => {
  beforeEach(() => {
    vi.mocked(getSettingJson).mockReturnValue(undefined)
  })

  it('returns empty object for null slug', () => {
    expect(getRepoEnvVars(null)).toEqual({})
  })

  it('returns empty object for undefined slug', () => {
    expect(getRepoEnvVars(undefined)).toEqual({})
  })

  it('returns empty object when repo list is empty', () => {
    vi.mocked(getSettingJson).mockReturnValue([])
    expect(getRepoEnvVars('myrepo')).toEqual({})
  })

  it('returns empty object when repo has no envVars field', () => {
    vi.mocked(getSettingJson).mockReturnValue([
      { name: 'myrepo', localPath: '/repos/myrepo' }
    ])
    expect(getRepoEnvVars('myrepo')).toEqual({})
  })

  it('returns envVars for a matching repo slug', () => {
    vi.mocked(getSettingJson).mockReturnValue([
      { name: 'myrepo', localPath: '/repos/myrepo', envVars: { NODE_AUTH_TOKEN: 'tok123' } }
    ])
    expect(getRepoEnvVars('myrepo')).toEqual({ NODE_AUTH_TOKEN: 'tok123' })
  })

  it('is case-insensitive, matching getRepoConfig semantics', () => {
    vi.mocked(getSettingJson).mockReturnValue([
      { name: 'MyRepo', localPath: '/repos/myrepo', envVars: { KEY: 'val' } }
    ])
    expect(getRepoEnvVars('myrepo')).toEqual({ KEY: 'val' })
    expect(getRepoEnvVars('MYREPO')).toEqual({ KEY: 'val' })
  })
})
```

Also add the import for `getRepoEnvVars` to the import line for paths:

```typescript
import { validateWorktreeBase, validateTestDbPath, getRepoEnvVars } from '../paths'
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- --run src/main/__tests__/paths.test.ts
```

Expected: `getRepoEnvVars` tests fail with "getRepoEnvVars is not a function" (or similar import error). Existing tests pass.

- [ ] **Step 3: Add `envVars?` to `RepoConfig` and implement `getRepoEnvVars`**

In `src/main/paths.ts`, update the `RepoConfig` interface (currently ends at `promptProfile?`):

```typescript
export interface RepoConfig {
  name: string
  localPath: string
  githubOwner?: string
  githubRepo?: string
  color?: string
  /**
   * Selects the pipeline prompt preamble:
   * - `'fleet'` (default): full FLEET-monorepo preamble
   * - `'minimal'`: short preamble for non-FLEET targets
   */
  promptProfile?: 'fleet' | 'minimal'
  /** Per-repo env vars injected into pipeline agent spawn env. Stored in plaintext. */
  envVars?: Record<string, string>
}
```

The `isRepoConfig` validator (`typeof r.name === 'string' && r.name.trim() !== ''`) already accepts any extra optional fields — no change needed there.

Add `getRepoEnvVars` after `getRepoPromptProfile`:

```typescript
export function getRepoEnvVars(repoSlug: string | null | undefined): Record<string, string> {
  if (!repoSlug) return {}
  return getRepoConfig(repoSlug)?.envVars ?? {}
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- --run src/main/__tests__/paths.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/paths.ts src/main/__tests__/paths.test.ts
git commit -m "feat(paths): add RepoConfig.envVars field and getRepoEnvVars helper"
```

---

### Task 2: Thread `extraEnv` through the spawn chain

**Files:**
- Modify: `src/main/agent-manager/sdk-adapter.ts`
- Modify: `src/main/agent-manager/spawn-and-wire.ts`
- Modify: `src/main/agent-manager/__tests__/sdk-adapter.test.ts`

- [ ] **Step 1: Write the failing tests**

Open `src/main/agent-manager/__tests__/sdk-adapter.test.ts`. Append two tests inside the existing `describe('pipeline agent SDK options', ...)` block:

```typescript
  it('merges extraEnv into the agent spawn environment', async () => {
    await spawnAgent({
      prompt: 'test',
      cwd: '/tmp',
      model: DEFAULT_MODEL,
      extraEnv: { NODE_AUTH_TOKEN: 'test-token-123' }
    })
    const callArgs = vi.mocked(sdk.query).mock.calls[0]?.[0]
    expect(callArgs?.options?.env?.NODE_AUTH_TOKEN).toBe('test-token-123')
  })

  it('spawns normally when extraEnv is absent', async () => {
    await spawnAgent({ prompt: 'test', cwd: '/tmp', model: DEFAULT_MODEL })
    const callArgs = vi.mocked(sdk.query).mock.calls[0]?.[0]
    expect(callArgs?.options?.env?.NODE_AUTH_TOKEN).toBeUndefined()
  })
```

- [ ] **Step 2: Run to confirm the tests fail**

```bash
npm test -- --run src/main/agent-manager/__tests__/sdk-adapter.test.ts
```

Expected: "extraEnv" tests fail with TypeScript error (extraEnv not in opts type) or runtime assertion failure.

- [ ] **Step 3: Update `sdk-adapter.ts` — add `extraEnv` to `spawnClaudeAgent` and merge it**

Locate `spawnClaudeAgent` (around line 240). Add `extraEnv?` to its opts and merge it into `env`:

```typescript
async function spawnClaudeAgent(opts: {
  prompt: string
  cwd: string
  model: string
  maxBudgetUsd?: number | undefined
  logger?: Logger | undefined
  pipelineTuning?: PipelineSpawnTuning | undefined
  taskId?: string | undefined
  agentType?: string | undefined
  tickId?: string | undefined
  extraEnv?: Record<string, string> | undefined
}): Promise<AgentHandle> {
  const env = { ...buildAgentEnv(), ...opts.extraEnv }
  // rest of function unchanged
```

- [ ] **Step 4: Add `extraEnv` to `spawnAgent` opts and pass it through**

Locate `spawnAgent`'s opts interface (around line 107). Add the field at the end, before the closing `}`):

```typescript
  /** Per-repo env vars to merge into the base agent env. */
  extraEnv?: Record<string, string> | undefined
```

`spawnAgent` already calls `spawnClaudeAgent({ ...opts, model: resolved.model })` — the spread means `extraEnv` is forwarded automatically. No further change needed in `spawnAgent`'s body.

- [ ] **Step 5: Add `extraEnv` as the 11th parameter of `spawnWithTimeout` and pass it to `spawnAgent`**

Update `spawnWithTimeout`'s signature (append after `epicGroupService?`):

```typescript
export async function spawnWithTimeout(
  prompt: string,
  cwd: string,
  model: string,
  logger: Logger,
  maxBudgetUsd?: number,
  pipelineTuning?: PipelineSpawnTuning,
  worktreeBase?: string,
  branch?: string,
  tickId?: string,
  epicGroupService?: EpicGroupService,
  extraEnv?: Record<string, string>
): Promise<AgentHandle> {
```

Update the `spawnAgent(...)` call inside `spawnWithTimeout` to pass `extraEnv`:

```typescript
  return await Promise.race([
    spawnAgent({ prompt, cwd, model, logger, maxBudgetUsd, pipelineTuning, worktreeBase, branch, tickId, epicGroupService, extraEnv }),
    timeoutPromise
  ]).finally(() => clearTimeout(timer!))
```

- [ ] **Step 6: Wire `getRepoEnvVars` in `spawn-and-wire.ts`**

Add the import at the top of `src/main/agent-manager/spawn-and-wire.ts` (with the other main-process imports):

```typescript
import { getRepoEnvVars } from '../../paths'
```

Inside `spawnAndWireAgent`, just before the `spawnWithTimeout` call, add:

```typescript
  const extraEnv = getRepoEnvVars(task.repo)
```

Then update the `spawnWithTimeout` call to pass `extraEnv` as the 11th argument:

```typescript
    handle = await spawnWithTimeout(
      prompt,
      worktree.worktreePath,
      effectiveModel,
      logger,
      task.max_cost_usd ?? undefined,
      pipelineTuning,
      deps.worktreeBase,
      worktree.branch,
      deps.tickId,
      undefined,  // epicGroupService — not used in pipeline spawn path
      extraEnv
    )
```

- [ ] **Step 7: Run the tests to confirm they pass**

```bash
npm test -- --run src/main/agent-manager/__tests__/sdk-adapter.test.ts
```

Expected: all tests including the two new ones pass.

- [ ] **Step 8: Run the full suite to confirm nothing broke**

```bash
npm test -- --run
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/main/agent-manager/sdk-adapter.ts \
        src/main/agent-manager/spawn-and-wire.ts \
        src/main/agent-manager/__tests__/sdk-adapter.test.ts
git commit -m "feat(agents): thread extraEnv through spawn chain for per-repo env injection"
```

---

### Task 3: Settings UI — per-repo env vars editor

**Files:**
- Modify: `src/renderer/src/components/settings/RepositoriesSection.tsx`
- Modify: `src/renderer/src/components/settings/RepositoriesSection.css`
- Modify: `src/renderer/src/components/settings/__tests__/RepositoriesSection.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/renderer/src/components/settings/__tests__/RepositoriesSection.test.tsx`:

```typescript
  it('renders env vars count badge when repo has envVars', async () => {
    vi.mocked(window.api.settings.getJson).mockResolvedValue([
      {
        name: 'my-repo',
        localPath: '/home/user/my-repo',
        envVars: { NODE_AUTH_TOKEN: 'tok', REGISTRY: 'https://npm.pkg.github.com' }
      }
    ])
    render(<RepositoriesSection />)
    await waitFor(() => {
      expect(screen.getByText(/Env vars \(2\)/)).toBeInTheDocument()
    })
  })

  it('expands env var editor when Env vars button is clicked', async () => {
    vi.mocked(window.api.settings.getJson).mockResolvedValue([
      {
        name: 'my-repo',
        localPath: '/home/user/my-repo',
        envVars: { NODE_AUTH_TOKEN: 'tok123' }
      }
    ])
    render(<RepositoriesSection />)
    await waitFor(() => screen.getByText(/Env vars/))
    await userEvent.click(screen.getByText(/Env vars/))
    expect(screen.getByDisplayValue('NODE_AUTH_TOKEN')).toBeInTheDocument()
    expect(screen.getByDisplayValue('tok123')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run to confirm the tests fail**

```bash
npm test -- --run src/renderer/src/components/settings/__tests__/RepositoriesSection.test.tsx
```

Expected: the two new tests fail.

- [ ] **Step 3: Update `RepositoriesSection.tsx` — add types and state**

Add `envVars?` to the local `RepoConfig` interface at the top of the file:

```typescript
interface RepoConfig {
  name: string
  localPath: string
  githubOwner?: string | undefined
  githubRepo?: string | undefined
  color?: string | undefined
  envVars?: Record<string, string> | undefined
}
```

Add two new state values (after the existing `useState` declarations):

```typescript
const [expandedEnvRepo, setExpandedEnvRepo] = useState<string | null>(null)
const [editingEnvPairs, setEditingEnvPairs] = useState<Array<{ key: string; value: string }>>([])
```

Add these two pure helpers outside the component (before the `export function`):

```typescript
function envVarsToArray(envVars: Record<string, string> | undefined): Array<{ key: string; value: string }> {
  return Object.entries(envVars ?? {}).map(([key, value]) => ({ key, value }))
}

function arrayToEnvVars(pairs: Array<{ key: string; value: string }>): Record<string, string> | undefined {
  const result: Record<string, string> = {}
  for (const { key, value } of pairs) {
    if (key.trim()) result[key.trim()] = value
  }
  return Object.keys(result).length > 0 ? result : undefined
}
```

- [ ] **Step 4: Add `handleToggleEnvVars` and `handleSaveEnvVars` callbacks**

Add inside the component body, after the existing `saveRepos` callback:

```typescript
  const handleToggleEnvVars = useCallback(
    (repoName: string, currentEnvVars: Record<string, string> | undefined) => {
      if (expandedEnvRepo === repoName) {
        setExpandedEnvRepo(null)
      } else {
        setExpandedEnvRepo(repoName)
        setEditingEnvPairs(envVarsToArray(currentEnvVars))
      }
    },
    [expandedEnvRepo]
  )

  const handleSaveEnvVars = useCallback(
    async (repoName: string) => {
      const envVars = arrayToEnvVars(editingEnvPairs)
      const updated = repos.map((r) => (r.name === repoName ? { ...r, envVars } : r))
      await saveRepos(updated)
      setExpandedEnvRepo(null)
    },
    [repos, editingEnvPairs, saveRepos]
  )
```

- [ ] **Step 5: Update the repo card render to add the env vars toggle and editor**

Replace the `repos.map((r) => ...)` block. The key changes are:
1. Add "Env vars" button to the card footer
2. Conditionally render the editor inside the card's children

```typescript
        {repos.map((r) => {
          const envCount = Object.keys(r.envVars ?? {}).length
          const isExpanded = expandedEnvRepo === r.name

          return (
            <SettingsCard
              key={r.name}
              title={r.name}
              subtitle={r.localPath}
              icon={
                <span
                  className="settings-repo__dot"
                  style={{ background: r.color ?? 'var(--fleet-text-dim)' }}
                />
              }
              footer={
                <div className="settings-card-footer-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleEnvVars(r.name, r.envVars)}
                    type="button"
                    aria-expanded={isExpanded}
                  >
                    {`Env vars${envCount > 0 ? ` (${envCount})` : ''}`}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(r.name)}
                    disabled={deletingName === r.name}
                    loading={deletingName === r.name}
                    title="Remove repository"
                    aria-label="Remove repository"
                    type="button"
                  >
                    <Trash2 size={14} /> {deletingName === r.name ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              }
            >
              {r.githubOwner && r.githubRepo && (
                <span className="settings-repo__github">
                  {r.githubOwner}/{r.githubRepo}
                </span>
              )}
              {isExpanded && (
                <div className="settings-repo__env-editor">
                  <p className="settings-repo__env-warning">
                    Values are stored unencrypted in the app database. Do not store secrets you
                    would not write to <code>.npmrc</code> or a <code>.env</code> file.
                  </p>
                  {editingEnvPairs.map((pair, i) => (
                    <div key={i} className="settings-repo__env-row">
                      <input
                        className="settings-field__input"
                        placeholder="KEY"
                        aria-label={`Environment variable key ${i + 1}`}
                        value={pair.key}
                        onChange={(e) => {
                          const updated = [...editingEnvPairs]
                          updated[i] = { ...updated[i], key: e.target.value }
                          setEditingEnvPairs(updated)
                        }}
                      />
                      <input
                        className="settings-field__input"
                        placeholder="value"
                        aria-label={`Environment variable value ${i + 1}`}
                        value={pair.value}
                        onChange={(e) => {
                          const updated = [...editingEnvPairs]
                          updated[i] = { ...updated[i], value: e.target.value }
                          setEditingEnvPairs(updated)
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        aria-label="Remove variable"
                        onClick={() => setEditingEnvPairs(editingEnvPairs.filter((_, j) => j !== i))}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <div className="settings-repo__env-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => setEditingEnvPairs([...editingEnvPairs, { key: '', value: '' }])}
                    >
                      + Add variable
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      type="button"
                      onClick={() => handleSaveEnvVars(r.name)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </SettingsCard>
          )
        })}
```

- [ ] **Step 6: Add CSS to `RepositoriesSection.css`**

Append to `src/renderer/src/components/settings/RepositoriesSection.css`:

```css
/* --- Per-repo env vars editor --- */

.settings-repo__env-editor {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-repo__env-warning {
  font-size: 11px;
  color: var(--fleet-text-dim);
  margin: 0 0 4px;
  line-height: 1.4;
}

.settings-repo__env-warning code {
  font-family: var(--fleet-font-mono, monospace);
  background: var(--fleet-bg-subtle, rgba(255,255,255,0.06));
  padding: 1px 3px;
  border-radius: 3px;
}

.settings-repo__env-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.settings-repo__env-row .settings-field__input {
  flex: 1;
  min-width: 0;
}

.settings-repo__env-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 4px;
}
```

- [ ] **Step 7: Run the tests to confirm they pass**

```bash
npm test -- --run src/renderer/src/components/settings/__tests__/RepositoriesSection.test.tsx
```

Expected: all tests including the two new ones pass.

- [ ] **Step 8: Run full type-check and test suite**

```bash
npm run typecheck && npm test -- --run
```

Expected: zero type errors, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/components/settings/RepositoriesSection.tsx \
        src/renderer/src/components/settings/RepositoriesSection.css \
        src/renderer/src/components/settings/__tests__/RepositoriesSection.test.tsx
git commit -m "feat(settings): add per-repo env vars editor to Repositories section"
```

---

### Task 4: Module documentation

**Files:**
- Modify: `docs/modules/lib/main/index.md`

- [ ] **Step 1: Update the `paths.ts` row**

Find the `paths.ts` row in `docs/modules/lib/main/index.md`. It ends with the public API list: `..., getRepoPath`.

Append `getRepoEnvVars` to that list:

```
... `getConfiguredRepos`, `getRepoPath`, `getRepoEnvVars`
```

- [ ] **Step 2: Commit**

```bash
git add docs/modules/lib/main/index.md
git commit -m "docs(modules): add getRepoEnvVars to paths.ts module index"
```

---

## Self-Review

**Spec coverage:**
- ✅ `RepoConfig.envVars?` field added (Task 1)
- ✅ `isRepoConfig` validator — no change needed (validator already accepts extra optional fields) 
- ✅ `getRepoEnvVars()` helper (Task 1)
- ✅ Injection via `spawnClaudeAgent` → merged with `buildAgentEnv()` (Task 2)
- ✅ `extraEnv` threaded: `spawnAndWireAgent` → `spawnWithTimeout` → `spawnAgent` → `spawnClaudeAgent` (Task 2)
- ✅ Adhoc agents untouched — no injection (Task 2 only touches pipeline spawn path)
- ✅ Merge order: `{ ...base, ...extraEnv }` — repo vars win (Task 2)
- ✅ Settings UI with key-value editor (Task 3)
- ✅ Plaintext warning banner in UI (Task 3)
- ✅ Module docs updated (Task 4)

**Placeholder scan:** none found.

**Type consistency:** `extraEnv: Record<string, string>` used consistently across all tasks. `editingEnvPairs: Array<{ key: string; value: string }>` is local to the UI and does not cross boundaries.
