import React, { useMemo, useState, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useSprintFilters } from '../../stores/sprintFilters'
import { useFilterPresets } from '../../stores/filterPresets'
import { PromptModal } from '../ui/PromptModal'
import type { SprintTask } from '../../../../shared/types'

const SEARCH_DEBOUNCE_MS = 150

interface PipelineFilterBarProps {
  tasks: SprintTask[]
}

export function PipelineFilterBar({ tasks }: PipelineFilterBarProps): React.JSX.Element | null {
  const searchQuery = useSprintFilters((s) => s.searchQuery)
  const setSearchQuery = useSprintFilters((s) => s.setSearchQuery)
  const repoFilter = useSprintFilters((s) => s.repoFilter)
  const setRepoFilter = useSprintFilters((s) => s.setRepoFilter)
  const statusFilter = useSprintFilters((s) => s.statusFilter)
  const setStatusFilter = useSprintFilters((s) => s.setStatusFilter)
  const tagFilter = useSprintFilters((s) => s.tagFilter)

  const presets = useFilterPresets((s) => s.presets)
  const savePreset = useFilterPresets((s) => s.savePreset)
  const loadPreset = useFilterPresets((s) => s.loadPreset)
  const deletePreset = useFilterPresets((s) => s.deletePreset)
  const [showSavePrompt, setShowSavePrompt] = useState(false)

  const [localSearch, setLocalSearch] = useState(searchQuery)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback(
    (value: string): void => {
      setLocalSearch(value)
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        setSearchQuery(value)
        debounceTimerRef.current = null
      }, SEARCH_DEBOUNCE_MS)
    },
    [setSearchQuery]
  )

  const repos = useMemo(() => Array.from(new Set(tasks.map((t) => t.repo))).sort(), [tasks])
  const hasActiveFilters = !!(searchQuery || repoFilter || tagFilter || statusFilter !== 'all')
  const presetNames = Object.keys(presets)

  if (repos.length <= 1 && !searchQuery && presetNames.length === 0) return null

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '0 var(--s-2)',
    height: 22,
    background: active ? 'var(--accent-soft)' : 'none',
    border: `1px solid ${active ? 'var(--accent-line)' : 'var(--line)'}`,
    borderRadius: 'var(--r-md)',
    color: active ? 'var(--accent)' : 'var(--fg-3)',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s-2)',
        padding: '0 var(--s-4)',
        height: 38,
        borderBottom: '1px solid var(--line)',
        flexShrink: 0,
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s-1)',
          padding: '0 var(--s-2)',
          height: 26,
          background: 'var(--surf-1)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)',
          flexShrink: 0,
          minWidth: 160,
        }}
      >
        <Search size={11} color="var(--fg-4)" />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: 'var(--fg)',
            fontSize: 12,
            width: '100%',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {repos.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-1)' }}>
          <button style={chipStyle(!repoFilter)} onClick={() => setRepoFilter(null)} aria-pressed={!repoFilter}>
            All
          </button>
          {repos.map((repo) => (
            <button
              key={repo}
              style={chipStyle(repoFilter === repo)}
              onClick={() => setRepoFilter(repoFilter === repo ? null : repo)}
              aria-pressed={repoFilter === repo}
            >
              {repo}
            </button>
          ))}
        </div>
      )}

      {presetNames.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-1)' }}>
          {presetNames.map((name) => (
            <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                style={chipStyle(false)}
                onClick={() => {
                  const preset = loadPreset(name)
                  if (preset) {
                    setRepoFilter(preset.repoFilter)
                    setSearchQuery(preset.searchQuery)
                    setStatusFilter(preset.statusFilter)
                  }
                }}
              >
                {name}
              </button>
              <button
                onClick={() => deletePreset(name)}
                aria-label={`Delete preset "${name}"`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  color: 'var(--fg-4)',
                  cursor: 'pointer',
                  padding: 2,
                  borderRadius: 'var(--r-sm)',
                }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {hasActiveFilters && (
        <button
          onClick={() => setShowSavePrompt(true)}
          style={{
            marginLeft: 'auto',
            padding: '0 var(--s-2)',
            height: 22,
            background: 'none',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            color: 'var(--fg-3)',
            fontSize: 11,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Save View
        </button>
      )}

      <PromptModal
        open={showSavePrompt}
        title="Save Filter Preset"
        message="Enter a name for this filter preset:"
        placeholder="e.g. Active FLEET tasks"
        confirmLabel="Save"
        onConfirm={(name) => {
          savePreset(name, { repoFilter, searchQuery, statusFilter })
          setShowSavePrompt(false)
        }}
        onCancel={() => setShowSavePrompt(false)}
      />
    </div>
  )
}
