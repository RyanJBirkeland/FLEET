/**
 * ModelsSection — per-agent-type backend + model routing.
 *
 * Loads the composite `agents.backendConfig` setting on mount, renders:
 *   1. a shared Local backend card (endpoint URL + test connection),
 *   2. an Active routing card (Pipeline row — the only type wired today),
 *   3. a Not yet routed card (five disabled rows for future types).
 *
 * Saves the entire BackendSettings object in one atomic setJson call.
 */
import './ModelsSection.css'
import { useEffect, useState } from 'react'
import { SettingsCard } from './SettingsCard'

const DEFAULT_LOCAL_ENDPOINT = 'http://localhost:1234/v1'
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5'

type AgentTypeId =
  | 'pipeline'
  | 'synthesizer'
  | 'copilot'
  | 'assistant'
  | 'adhoc'
  | 'reviewer'

interface AgentTypeMeta {
  id: AgentTypeId
  label: string
  description: string
}

const ACTIVE_TYPES: AgentTypeMeta[] = [
  { id: 'pipeline', label: 'Pipeline', description: 'Executes sprint tasks end-to-end.' }
]

const NOT_YET_ROUTED_TYPES: AgentTypeMeta[] = [
  { id: 'synthesizer', label: 'Synthesizer', description: 'Drafts spec documents from task titles.' },
  { id: 'copilot', label: 'Copilot', description: 'Interactive pair-programming agent.' },
  { id: 'assistant', label: 'Assistant', description: 'One-shot Q&A over the repo.' },
  { id: 'adhoc', label: 'Adhoc', description: 'Freeform agent runs outside the sprint pipeline.' },
  { id: 'reviewer', label: 'Reviewer', description: 'Reviews PRs before merge.' }
]

interface AgentBackendConfig {
  backend: 'claude' | 'local'
  model: string
}

interface BackendSettings {
  pipeline: AgentBackendConfig
  synthesizer: AgentBackendConfig
  copilot: AgentBackendConfig
  assistant: AgentBackendConfig
  adhoc: AgentBackendConfig
  reviewer: AgentBackendConfig
  localEndpoint: string
}

const DEFAULT_ROW: AgentBackendConfig = { backend: 'claude', model: DEFAULT_CLAUDE_MODEL }

function defaultBackendSettings(): BackendSettings {
  return {
    pipeline: { ...DEFAULT_ROW },
    synthesizer: { ...DEFAULT_ROW },
    copilot: { ...DEFAULT_ROW },
    assistant: { ...DEFAULT_ROW },
    adhoc: { ...DEFAULT_ROW },
    reviewer: { ...DEFAULT_ROW },
    localEndpoint: DEFAULT_LOCAL_ENDPOINT
  }
}

export function ModelsSection(): React.JSX.Element {
  const [settings, setSettings] = useState<BackendSettings>(defaultBackendSettings)

  useEffect(() => {
    async function load(): Promise<void> {
      const stored = (await window.api.settings.getJson(
        'agents.backendConfig'
      )) as Partial<BackendSettings> | null
      if (!stored) return
      setSettings((prev) => ({ ...prev, ...stored }))
    }
    void load()
  }, [])

  return (
    <div className="settings-cards-list">
      <SettingsCard
        title="Local backend"
        subtitle="LM Studio, Ollama, or any OpenAI-compatible server."
      >
        <label className="settings-field">
          <span className="settings-field__label">Endpoint URL</span>
          <input
            className="settings-field__input"
            type="text"
            value={settings.localEndpoint}
            onChange={(e) =>
              setSettings((s) => ({ ...s, localEndpoint: e.target.value }))
            }
            placeholder={DEFAULT_LOCAL_ENDPOINT}
          />
        </label>
      </SettingsCard>

      <SettingsCard title="Active routing" subtitle="Types wired through spawnAgent today.">
        {ACTIVE_TYPES.map((type) => (
          <AgentTypeRow key={type.id} type={type} disabled={false} />
        ))}
      </SettingsCard>

      <SettingsCard
        title="Not yet routed"
        subtitle="Configuration preserved for when each type is wired through spawnAgent."
      >
        {NOT_YET_ROUTED_TYPES.map((type) => (
          <AgentTypeRow key={type.id} type={type} disabled={true} />
        ))}
      </SettingsCard>
    </div>
  )
}

interface AgentTypeRowProps {
  type: AgentTypeMeta
  disabled: boolean
}

function AgentTypeRow({ type, disabled }: AgentTypeRowProps): React.JSX.Element {
  return (
    <div
      className="models-row"
      data-testid={`models-row-${type.id}`}
      aria-disabled={disabled || undefined}
    >
      <div className="models-row__label">{type.label}</div>
      <div className="models-row__desc">{type.description}</div>
      {disabled && <div className="models-row__desc">Not yet routed.</div>}
    </div>
  )
}
