/**
 * Sprint mutation observer — pub/sub for task CRUD events.
 * Extracted from sprint-local.ts to decouple SSE broadcasting
 * and event-store cleanup from handler registration.
 */
import type { SprintTask } from '../../shared/types'
import { createLogger } from '../logger'
import { broadcast } from '../broadcast'
import { createWebhookService, getWebhookEventName } from '../services/webhook-service'
import { getWebhooks } from '../data/webhook-queries'

const logger = createLogger('sprint-listeners')

export type SprintMutationEvent = {
  type: 'created' | 'updated' | 'deleted'
  task: SprintTask
}
export type SprintMutationListener = (event: SprintMutationEvent) => void

const listeners: Set<SprintMutationListener> = new Set()

// Initialize webhook service
const webhookService = createWebhookService({ getWebhooks, logger })

export function onSprintMutation(cb: SprintMutationListener): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function notifySprintMutation(type: SprintMutationEvent['type'], task: SprintTask): void {
  const event = { type, task }
  for (const cb of listeners) {
    try {
      cb(event)
    } catch (err) {
      logger.error(`${err}`)
    }
  }

  // Push to renderer windows so Dashboard/SprintCenter refresh immediately
  broadcast('sprint:externalChange')

  // Fire webhooks for external integrations
  try {
    const webhookEvent = getWebhookEventName(type, task)
    webhookService.fireWebhook(webhookEvent, task)
  } catch (err) {
    logger.error(`[webhook] ${err}`)
  }
}
