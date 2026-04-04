/**
 * CreateEpicModal — form for creating a new task group (epic).
 * Fields: name (required), icon (single char), goal (optional).
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../ui/Button'
import { VARIANTS, SPRINGS, REDUCED_TRANSITION, useReducedMotion } from '../../lib/motion'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useTaskGroups } from '../../stores/taskGroups'

interface CreateEpicModalProps {
  open: boolean
  onClose: () => void
}

export function CreateEpicModal({ open, onClose }: CreateEpicModalProps): React.JSX.Element {
  const reduced = useReducedMotion()
  const { createGroup, selectGroup } = useTaskGroups()

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('E')
  const [goal, setGoal] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const nameRef = useRef<HTMLInputElement>(null)
  const iconRef = useRef<HTMLInputElement>(null)
  const goalRef = useRef<HTMLTextAreaElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useFocusTrap(dialogRef, open)

  useEffect(() => {
    if (open) {
      // Reset form on open
      setName('')
      setIcon('E')
      setGoal('')
      setSubmitting(false)
      // Focus name input
      requestAnimationFrame(() => {
        nameRef.current?.focus()
      })
    }
  }, [open])

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return
    if (submitting) return

    setSubmitting(true)
    try {
      const newGroup = await createGroup({
        name: name.trim(),
        icon: icon.trim() || 'E',
        goal: goal.trim() || undefined
      })
      if (newGroup) {
        // Select the newly created group
        selectGroup(newGroup.id)
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }, [name, icon, goal, submitting, createGroup, selectGroup, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (!submitting) onClose()
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        handleSubmit()
      }
    },
    [onClose, handleSubmit, submitting]
  )

  // Enforce single-char icon
  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value
    // Take only the last character (supports multi-char paste)
    if (val.length > 0) {
      setIcon(val.slice(-1))
    } else {
      setIcon('')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="prompt-modal__overlay" onClick={submitting ? undefined : onClose} />
          <motion.div
            ref={dialogRef}
            className="prompt-modal glass-modal elevation-3"
            variants={VARIANTS.scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={reduced ? REDUCED_TRANSITION : SPRINGS.snappy}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-epic-modal-title"
          >
            <div className="prompt-modal__title" id="create-epic-modal-title">
              New Epic
            </div>

            <div className="prompt-modal__message">
              Create a new task group to organize related work.
            </div>

            {/* Name field */}
            <label className="prompt-modal__label" htmlFor="epic-name">
              Name <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              ref={nameRef}
              id="epic-name"
              type="text"
              className="prompt-modal__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Agent System Overhaul"
              aria-required="true"
            />

            {/* Icon field */}
            <label className="prompt-modal__label" htmlFor="epic-icon">
              Icon
            </label>
            <input
              ref={iconRef}
              id="epic-icon"
              type="text"
              className="prompt-modal__input"
              value={icon}
              onChange={handleIconChange}
              placeholder="E"
              style={{ width: '60px', textAlign: 'center' }}
            />

            {/* Goal field */}
            <label className="prompt-modal__label" htmlFor="epic-goal">
              Goal (optional)
            </label>
            <textarea
              ref={goalRef}
              id="epic-goal"
              className="prompt-modal__textarea"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Brief description of this epic's purpose"
              rows={4}
            />

            <div className="prompt-modal__hint">Press Cmd+Enter to create, Escape to cancel</div>

            <div className="prompt-modal__actions">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!name.trim() || submitting}
              >
                {submitting ? 'Creating...' : 'Create Epic'}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
