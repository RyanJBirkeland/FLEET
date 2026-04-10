/**
 * Sprint mutation observer — backward compatibility shim.
 * Re-exports from sprint-service to maintain existing import paths.
 *
 * The notification logic now lives in the service layer where it belongs.
 * This file exists only to avoid breaking handlers/review.ts and tests
 * that import from here.
 */
export {
  onSprintMutation,
  notifySprintMutation,
  type SprintMutationEvent,
  type SprintMutationListener
} from '../services/sprint-service'
