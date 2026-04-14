/**
 * useWebhookManager — owns all webhook CRUD state and async operations.
 * Returns the webhook list, loading flag, visibility/testing sets, and
 * all event handlers needed to render the webhook settings UI.
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from '../stores/toasts'
import type { Webhook } from '../../../shared/ipc-channels'

export interface WebhookManager {
  webhooks: Webhook[]
  webhooksLoaded: boolean
  visibleSecrets: Set<string>
  testing: Set<string>
  handleAddWebhook: () => Promise<void>
  handleRemoveWebhook: (id: string) => Promise<void>
  handleUrlChange: (id: string, url: string) => Promise<void>
  handleEventToggle: (id: string, event: string, checked: boolean) => Promise<void>
  handleSecretChange: (id: string, secret: string) => Promise<void>
  handleSecretBlur: (id: string) => Promise<void>
  handleToggleEnabled: (id: string, enabled: boolean) => Promise<void>
  handleTestWebhook: (id: string) => Promise<void>
  toggleSecretVisibility: (id: string) => void
}

export function useWebhookManager(): WebhookManager {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [webhooksLoaded, setWebhooksLoaded] = useState(false)
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set())
  const [testing, setTesting] = useState<Set<string>>(new Set())

  const loadWebhooks = useCallback(async () => {
    const list = await window.api.webhooks.list()
    setWebhooks(list)
    setWebhooksLoaded(true)
  }, [])

  useEffect(() => {
    void loadWebhooks()
  }, [loadWebhooks])

  const handleAddWebhook = useCallback(async () => {
    try {
      const webhook = await window.api.webhooks.create({ url: 'https://', events: [] })
      setWebhooks((prev) => [webhook, ...prev])
      toast.success('Webhook created')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to create webhook: ${msg}`)
    }
  }, [])

  const handleRemoveWebhook = useCallback(async (id: string) => {
    try {
      await window.api.webhooks.delete({ id })
      setWebhooks((prev) => prev.filter((w) => w.id !== id))
      toast.success('Webhook removed')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to remove webhook: ${msg}`)
    }
  }, [])

  const handleUrlChange = useCallback(
    async (id: string, url: string) => {
      setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, url } : w)))
      try {
        await window.api.webhooks.update({ id, url })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error(`Failed to update URL: ${msg}`)
        void loadWebhooks()
      }
    },
    [loadWebhooks]
  )

  const handleEventToggle = useCallback(
    async (id: string, event: string, checked: boolean) => {
      const webhook = webhooks.find((w) => w.id === id)
      if (!webhook) return

      let newEvents: string[]
      if (event === '*') {
        // If "All Events" is toggled, clear all other events
        newEvents = checked ? ['*'] : []
      } else {
        // Remove "All Events" if a specific event is selected
        newEvents = webhook.events.filter((e) => e !== '*')
        if (checked) {
          newEvents = [...newEvents, event]
        } else {
          newEvents = newEvents.filter((e) => e !== event)
        }
      }

      setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, events: newEvents } : w)))

      try {
        await window.api.webhooks.update({ id, events: newEvents })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error(`Failed to update events: ${msg}`)
        void loadWebhooks()
      }
    },
    [webhooks, loadWebhooks]
  )

  const handleSecretChange = useCallback(async (id: string, secret: string) => {
    setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, secret } : w)))
  }, [])

  const handleSecretBlur = useCallback(
    async (id: string) => {
      const webhook = webhooks.find((w) => w.id === id)
      if (!webhook) return

      try {
        await window.api.webhooks.update({ id, secret: webhook.secret || null })
        toast.success('Secret saved')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error(`Failed to save secret: ${msg}`)
        void loadWebhooks()
      }
    },
    [webhooks, loadWebhooks]
  )

  const handleToggleEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, enabled } : w)))
      try {
        await window.api.webhooks.update({ id, enabled })
        toast.success(enabled ? 'Webhook enabled' : 'Webhook disabled')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error(`Failed to toggle webhook: ${msg}`)
        void loadWebhooks()
      }
    },
    [loadWebhooks]
  )

  const handleTestWebhook = useCallback(async (id: string) => {
    setTesting((prev) => new Set(prev).add(id))
    try {
      await window.api.webhooks.test({ id })
      toast.success('Test webhook delivered successfully')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Test failed: ${msg}`)
    } finally {
      setTesting((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const toggleSecretVisibility = useCallback((id: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  return {
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
  }
}
