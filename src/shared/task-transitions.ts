/**
 * @deprecated Import from './task-state-machine' directly. This shim exists
 * for backward compatibility with consumers in src/main/ and src/renderer/
 * that will be migrated in the D1c/D1d tasks.
 */
export {
  TERMINAL_STATUSES,
  FAILURE_STATUSES,
  HARD_SATISFIED_STATUSES,
  VALID_TRANSITIONS,
  isValidTransition
} from './task-state-machine'
