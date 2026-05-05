import { useState, useCallback, useEffect } from 'react'
import { useLocalAgentsStore } from '../../stores/localAgents'
import { usePromptTemplatesStore } from '../../stores/promptTemplates'
import { toast } from '../../stores/toasts'
import { assemblePrompt } from '../../lib/prompt-assembly'
import { useRepoOptions } from '../../hooks/useRepoOptions'
import type { PromptTemplate } from '../../lib/launchpad-types'

interface LaunchpadGridProps {
  onAgentSpawned: () => void
  onCancel?: (() => void) | undefined
}

function FormRow({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg)' }}>{label}</span>
        {hint && (
          <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  height: 32,
  background: 'var(--surf-1)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
  padding: '0 var(--s-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--fg)',
  width: '100%',
  boxSizing: 'border-box'
}

const textareaStyle: React.CSSProperties = {
  minHeight: 96,
  padding: 'var(--s-2) var(--s-3)',
  background: 'var(--surf-1)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--fg-3)',
  lineHeight: 1.5,
  resize: 'vertical',
  width: '100%',
  boxSizing: 'border-box'
}

export function LaunchpadGrid({ onAgentSpawned, onCancel }: LaunchpadGridProps): React.JSX.Element {
  const repos = useRepoOptions()

  const [repoPaths, setRepoPaths] = useState<Record<string, string>>({})
  const [selectedRepo, setSelectedRepo] = useState('')
  const [specPath, setSpecPath] = useState('')
  const [prompt, setPrompt] = useState('')

  const templates = usePromptTemplatesStore((s) => s.templates)
  const loadTemplates = usePromptTemplatesStore((s) => s.loadTemplates)
  const spawnAgent = useLocalAgentsStore((s) => s.spawnAgent)
  const fetchProcesses = useLocalAgentsStore((s) => s.fetchProcesses)
  const spawning = useLocalAgentsStore((s) => s.isSpawning)

  const effectiveRepo = selectedRepo || (repos.length > 0 ? (repos[0]?.label ?? '') : '')

  useEffect(() => {
    loadTemplates()
    window.api.git
      .getRepoPaths()
      .then(setRepoPaths)
      .catch((err) => {
        console.error('Failed to load repo paths:', err)
      })
  }, [loadTemplates])

  const visibleTemplates = templates.filter((t) => !t.hidden)

  const handleSpawn = useCallback(
    async (task: string, repo: string) => {
      const repoPath = repoPaths[repo.toLowerCase()]
      if (!repoPath) {
        toast.error(`Repo path not found for "${repo}"`)
        return
      }
      try {
        await spawnAgent({ task, repoPath, assistant: true })
        fetchProcesses()
        toast.success('Session started')
        onAgentSpawned()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(`Spawn failed: ${message}`)
      }
    },
    [repoPaths, spawnAgent, fetchProcesses, onAgentSpawned]
  )

  const handleTemplateSpawn = useCallback(
    (template: PromptTemplate, repo: string) => {
      const task = assemblePrompt(template, {})
      handleSpawn(task, repo)
    },
    [handleSpawn]
  )

  const handlePromptKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && prompt.trim()) {
        e.preventDefault()
        handleSpawn(prompt.trim(), effectiveRepo)
      }
    },
    [prompt, effectiveRepo, handleSpawn]
  )

  const handleSubmit = useCallback(() => {
    if (prompt.trim()) {
      handleSpawn(prompt.trim(), effectiveRepo)
    }
  }, [prompt, effectiveRepo, handleSpawn])

  return (
    <div
      data-testid="launchpad-grid"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-4)',
        background: 'var(--surf-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        padding: 'var(--s-5)'
      }}
    >
      {/* Quick actions */}
      <FormRow label="Quick actions">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 'var(--s-2)'
          }}
        >
          {visibleTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={spawning}
              onClick={() => handleTemplateSpawn(t, effectiveRepo)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--s-1)',
                padding: 'var(--s-3) var(--s-2)',
                background: 'var(--surf-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)',
                cursor: spawning ? 'default' : 'pointer',
                opacity: spawning ? 0.4 : 1,
                textAlign: 'center'
              }}
            >
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg)' }}>{t.name}</span>
              <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t.description}</span>
            </button>
          ))}
        </div>
      </FormRow>

      {/* Repository */}
      <FormRow label="Repository">
        <select
          style={selectStyle}
          value={effectiveRepo}
          onChange={(e) => setSelectedRepo(e.target.value)}
          aria-label={`Selected repository: ${effectiveRepo}`}
        >
          {repos.map((r) => (
            <option key={r.label} value={r.label}>
              {r.label}
            </option>
          ))}
        </select>
      </FormRow>

      {/* Task spec */}
      <FormRow label="Task spec" hint="step-by-step instructions file in the worktree">
        <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
          <input
            type="text"
            aria-label="Task spec file path"
            placeholder="path/to/spec.md (optional)"
            value={specPath}
            onChange={(e) => setSpecPath(e.target.value)}
            disabled={spawning}
            style={{
              ...selectStyle,
              flex: 1,
              height: 32,
              padding: '0 var(--s-3)',
              color: specPath ? 'var(--fg)' : 'var(--fg-3)'
            }}
          />
          <button
            type="button"
            disabled={spawning}
            onClick={() => {
              // TODO(verify): wire to IDE file picker when available
            }}
            style={{
              height: 32,
              padding: '0 var(--s-2)',
              background: 'transparent',
              border: '1px solid var(--line-2)',
              borderRadius: 'var(--r-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-2)',
              cursor: spawning ? 'default' : 'pointer',
              flexShrink: 0,
              opacity: spawning ? 0.4 : 1
            }}
          >
            Browse…
          </button>
        </div>
      </FormRow>

      {/* Task prompt */}
      <FormRow label="Task prompt" hint="opening message sent to the agent">
        <textarea
          aria-label="Agent prompt"
          placeholder="What would you like to work on?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handlePromptKeyDown}
          disabled={spawning}
          style={textareaStyle}
        />
      </FormRow>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid var(--line)',
          paddingTop: 'var(--s-3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-4)' }}>
          scratchpad agents auto-clean after 24h idle
        </span>
        <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                height: 30,
                padding: '0 var(--s-3)',
                background: 'transparent',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)',
                fontSize: 12,
                cursor: 'pointer',
                color: 'var(--fg-2)'
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={spawning}
            style={{
              height: 30,
              padding: '0 var(--s-3)',
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              border: 'none',
              borderRadius: 'var(--r-md)',
              fontSize: 12,
              fontWeight: 500,
              cursor: spawning ? 'default' : 'pointer',
              opacity: spawning ? 0.7 : 1
            }}
          >
            {spawning ? 'Spawning…' : 'Spawn agent ↵'}
          </button>
        </div>
      </div>
    </div>
  )
}
