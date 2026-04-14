/**
 * AgentManagerSection — configure AgentManager: concurrency, model, worktree base,
 * max runtime, auto-start, and webhooks. Changes take effect after app restart.
 */
import './AgentManagerSection.css'
import { useCallback, useEffect, useState } from 'react'
import { Trash2, Plus, Send, Eye, EyeOff } from 'lucide-react'
import { toast } from '../../stores/toasts'
import { Button } from '../ui/Button'
import { SettingsCard } from './SettingsCard'
import { useWebhookManager } from '../../hooks/useWebhookManager'

const DEFAULT_MAX_CONCURRENT = 2
const DEFAULT_MODEL = 'claude-sonnet-4-5'
const DEFAULT_WORKTREE_BASE = '~/worktrees/bde'
const DEFAULT_MAX_RUNTIME_MINUTES = 60
const DEFAULT_AUTO_START = true

const EVENT_OPTIONS = [
  { value: 'task.created', label: 'Task Created' },
  { value: 'task.started', label: 'Task Started' },
  { value: 'task.completed', label: 'Task Completed' },
  { value: 'task.failed', label: 'Task Failed' },
  { value: 'task.review', label: 'Task Ready for Review' },
  { value: 'task.updated', label: 'Task Updated' },
  { value: 'task.deleted', label: 'Task Deleted' },
  { value: '*', label: 'All Events' }
]

export function AgentManagerSection(): React.JSX.Element {
  const [maxConcurrent, setMaxConcurrent] = useState(DEFAULT_MAX_CONCURRENT)
  const [defaultModel, setDefaultModel] = useState(DEFAULT_MODEL)
  const [worktreeBase, setWorktreeBase] = useState(DEFAULT_WORKTREE_BASE)
  const [maxRuntimeMinutes, setMaxRuntimeMinutes] = useState(DEFAULT_MAX_RUNTIME_MINUTES)
  const [autoStart, setAutoStart] = useState(DEFAULT_AUTO_START)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const {
    webhooks,
    webhooksLoaded,
    visibleSecrets,
    testing,
    handleAddWebhook,
    handleRemoveWebhook,
    handleUrlChange,
    handleEventToggle,
    handleSecretChange,
    handleSecretBlur,
    handleToggleEnabled,
    handleTestWebhook,
    toggleSecretVisibility
  } = useWebhookManager()

  useEffect(() => {
    async function loadSettings(): Promise<void> {
      const [maxC, model, wtBase, maxRtMs, autoS] = await Promise.all([
        window.api.settings.getJson('agentManager.maxConcurrent'),
        window.api.settings.get('agentManager.defaultModel'),
        window.api.settings.get('agentManager.worktreeBase'),
        window.api.settings.getJson('agentManager.maxRuntimeMs'),
        window.api.settings.getJson('agentManager.autoStart')
      ])
      if (typeof maxC === 'number') setMaxConcurrent(maxC)
      if (typeof model === 'string' && model) setDefaultModel(model)
      if (typeof wtBase === 'string' && wtBase) setWorktreeBase(wtBase)
      if (typeof maxRtMs === 'number') setMaxRuntimeMinutes(maxRtMs / 60_000)
      if (typeof autoS === 'boolean') setAutoStart(autoS)
    }
    void loadSettings()
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await Promise.all([
        window.api.settings.setJson('agentManager.maxConcurrent', maxConcurrent),
        window.api.settings.set('agentManager.defaultModel', defaultModel),
        window.api.settings.set('agentManager.worktreeBase', worktreeBase),
        window.api.settings.setJson('agentManager.maxRuntimeMs', maxRuntimeMinutes * 60_000),
        window.api.settings.setJson('agentManager.autoStart', autoStart)
      ])
      setDirty(false)
      // Hot-reload safe fields in the running agent manager. worktreeBase and
      // autoStart still require restart; the helper tells us which changed.
      try {
        const result = await window.api.agentManager.reloadConfig()
        if (result.requiresRestart.length > 0) {
          toast.info(`Saved. Restart required for: ${result.requiresRestart.join(', ')}`)
        } else if (result.updated.length > 0) {
          toast.success(`Settings saved and applied: ${result.updated.join(', ')}`)
        } else {
          toast.success('Agent Manager settings saved')
        }
      } catch {
        toast.success('Agent Manager settings saved (restart to apply)')
      }
    } catch {
      toast.error('Failed to save Agent Manager settings')
    } finally {
      setSaving(false)
    }
  }, [maxConcurrent, defaultModel, worktreeBase, maxRuntimeMinutes, autoStart])

  function markDirty(): void {
    setDirty(true)
  }

  return (
    <div className="settings-cards-list">
      <SettingsCard
        title="Pipeline Configuration"
        subtitle="Most fields hot-reload instantly. Worktree base and Auto-start require a restart."
        footer={
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving}
            loading={saving}
            type="button"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        }
      >
        <label className="settings-field">
          <span className="settings-field__label">Max concurrent agents</span>
          <input
            className="settings-field__input"
            type="number"
            min={1}
            max={16}
            value={maxConcurrent}
            onChange={(e) => {
              setMaxConcurrent(Number(e.target.value))
              markDirty()
            }}
          />
          <span
            className="settings-field__hint"
            style={{
              fontSize: '11px',
              opacity: 0.7,
              marginTop: '4px',
              display: 'block',
              lineHeight: 1.4
            }}
          >
            Each agent runs its own `npm run test:coverage` during verification. Values above{' '}
            <strong>3</strong> on a typical laptop can oversaturate CPU and cause otherwise-passing
            tests to time out under load (load avg 140+ observed at 6 concurrent). Raise with
            caution.
          </span>
          {maxConcurrent > 3 && (
            <span
              role="alert"
              style={{
                display: 'block',
                marginTop: '6px',
                padding: '6px 10px',
                fontSize: '11px',
                color: 'var(--bde-warning)',
                border: '1px solid rgba(255, 159, 64, 0.4)',
                borderRadius: '4px',
                background: 'rgba(255, 159, 64, 0.08)'
              }}
            >
              ⚠ {maxConcurrent} concurrent agents may oversaturate this machine. Agents can misjudge
              load-induced test timeouts as &ldquo;pre-existing failures&rdquo; and push broken
              work. Recommended: 3 or lower.
            </span>
          )}
        </label>

        <label className="settings-field">
          <span className="settings-field__label">Default model</span>
          <input
            className="settings-field__input"
            type="text"
            value={defaultModel}
            onChange={(e) => {
              setDefaultModel(e.target.value)
              markDirty()
            }}
            placeholder="claude-sonnet-4-5"
          />
        </label>

        <label className="settings-field">
          <span className="settings-field__label">Worktree base</span>
          <input
            className="settings-field__input"
            type="text"
            value={worktreeBase}
            onChange={(e) => {
              setWorktreeBase(e.target.value)
              markDirty()
            }}
            placeholder="~/worktrees/bde"
          />
        </label>

        <label className="settings-field">
          <span className="settings-field__label">Max runtime (minutes)</span>
          <input
            className="settings-field__input"
            type="number"
            min={1}
            value={maxRuntimeMinutes}
            onChange={(e) => {
              setMaxRuntimeMinutes(Number(e.target.value))
              markDirty()
            }}
          />
        </label>

        <label className="settings-field">
          <span className="settings-field__label">Auto-start</span>
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => {
              setAutoStart(e.target.checked)
              markDirty()
            }}
          />
        </label>
      </SettingsCard>

      {webhooksLoaded && webhooks.length === 0 && (
        <span className="settings-repos__empty">No webhooks configured</span>
      )}

      {webhooks.map((webhook) => (
        <SettingsCard
          key={webhook.id}
          title={webhook.url}
          status={
            webhook.enabled
              ? { label: 'Enabled', variant: 'success' }
              : { label: 'Disabled', variant: 'neutral' }
          }
          footer={
            <div className="settings-card-footer-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleToggleEnabled(webhook.id, !webhook.enabled)}
                type="button"
                aria-label={webhook.enabled ? 'Disable webhook' : 'Enable webhook'}
              >
                {webhook.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleTestWebhook(webhook.id)}
                disabled={testing.has(webhook.id)}
                type="button"
                aria-label="Test webhook"
              >
                <Send size={14} />
                {testing.has(webhook.id) ? 'Sending...' : 'Test'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveWebhook(webhook.id)}
                type="button"
                aria-label="Remove webhook"
              >
                <Trash2 size={14} />
                Delete
              </Button>
            </div>
          }
        >
          <div className="settings-webhook-row">
            <label className="settings-field">
              <span className="settings-field__label">URL</span>
              <input
                className="settings-field__input"
                placeholder="https://example.com/webhook"
                value={webhook.url}
                onChange={(e) => handleUrlChange(webhook.id, e.target.value)}
              />
            </label>

            <label className="settings-field">
              <span className="settings-field__label">Secret (optional)</span>
              <div className="settings-secret-input">
                <input
                  className="settings-field__input"
                  type={visibleSecrets.has(webhook.id) ? 'text' : 'password'}
                  placeholder="Optional HMAC signing secret"
                  value={webhook.secret || ''}
                  onChange={(e) => handleSecretChange(webhook.id, e.target.value)}
                  onBlur={() => handleSecretBlur(webhook.id)}
                />
                {webhook.secret && (
                  <button
                    type="button"
                    className="settings-secret-input__toggle"
                    onClick={() => toggleSecretVisibility(webhook.id)}
                    aria-label={visibleSecrets.has(webhook.id) ? 'Hide secret' : 'Show secret'}
                  >
                    {visibleSecrets.has(webhook.id) ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            </label>

            <fieldset className="settings-field settings-fieldset-bare">
              <legend className="settings-field__label">Events</legend>
              <div className="settings-event-grid">
                {EVENT_OPTIONS.map((option) => (
                  <label key={option.value} className="settings-event-option">
                    <input
                      type="checkbox"
                      checked={webhook.events.includes(option.value)}
                      onChange={(e) =>
                        handleEventToggle(webhook.id, option.value, e.target.checked)
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </SettingsCard>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleAddWebhook}
        type="button"
        className="settings-repos__add-btn"
      >
        <Plus size={14} /> Add Webhook
      </Button>
    </div>
  )
}
