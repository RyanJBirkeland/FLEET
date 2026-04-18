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

export function ModelsSection(): React.JSX.Element {
  const [localEndpoint, setLocalEndpoint] = useState(DEFAULT_LOCAL_ENDPOINT)

  useEffect(() => {
    async function load(): Promise<void> {
      const stored = (await window.api.settings.getJson(
        'agents.backendConfig'
      )) as Partial<BackendSettings> | null
      if (stored?.localEndpoint) setLocalEndpoint(stored.localEndpoint)
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
            value={localEndpoint}
            onChange={(e) => setLocalEndpoint(e.target.value)}
            placeholder={DEFAULT_LOCAL_ENDPOINT}
          />
        </label>
      </SettingsCard>
    </div>
  )
}
