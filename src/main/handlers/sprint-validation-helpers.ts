/**
 * Shared validation helpers for sprint task handlers.
 * Extracted to reduce duplication across handlers.
 *
 * validateTaskSpec has been moved to the service layer; this file re-exports it
 * for backward compatibility with existing handler callers.
 */

export { validateTaskSpec } from '../services/spec-quality/index'
