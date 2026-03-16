import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { toast } from '../../stores/toasts'
import type { SprintTask } from './SprintCenter'

type SpecDrawerProps = {
  task: SprintTask | null
  onClose: () => void
  onSave: (taskId: string, spec: string) => void
  onLaunch: (task: SprintTask) => void
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[huplo])(.+)$/gm, '<p>$1</p>')
}

export function SpecDrawer({ task, onClose, onSave, onLaunch }: SpecDrawerProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (task) {
      setDraft(task.spec ?? '')
      setEditing(false)
      setDirty(false)
    }
  }, [task?.id])

  const save = useCallback(() => {
    if (!task) return
    onSave(task.id, draft)
    setEditing(false)
    setDirty(false)
    toast.success('Spec saved')
  }, [task, draft, onSave])

  useEffect(() => {
    if (!task) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 's' && e.metaKey && editing) {
        e.preventDefault()
        save()
      }
      if (e.key === 'Escape') {
        if (editing && dirty) {
          if (confirm('Discard unsaved changes?')) {
            setEditing(false)
            setDraft(task.spec ?? '')
            setDirty(false)
          }
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [task, editing, dirty, save, onClose])

  useEffect(() => {
    if (editing) editorRef.current?.focus()
  }, [editing])

  const isOpen = task !== null

  return (
    <>
      {isOpen && <div className="spec-drawer__overlay" onClick={onClose} />}
      <div className={`spec-drawer ${isOpen ? 'spec-drawer--open' : ''}`}>
        {task && (
          <>
            <div className="spec-drawer__header">
              <div className="spec-drawer__header-info">
                <h3>{task.title}</h3>
                <span className="spec-drawer__header-meta">
                  {task.repo} &middot; {task.status}
                </span>
              </div>
              <Button variant="icon" size="sm" onClick={onClose} title="Close">
                ✕
              </Button>
            </div>

            <div className="spec-drawer__toolbar">
              {!editing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" size="sm" onClick={save}>
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false)
                      setDraft(task.spec ?? '')
                      setDirty(false)
                    }}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>

            <div className="spec-drawer__body">
              {editing ? (
                <textarea
                  ref={editorRef}
                  className="spec-drawer__editor"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    setDirty(true)
                  }}
                  placeholder="Write your spec in markdown..."
                />
              ) : task.spec ? (
                <div
                  className="spec-drawer__rendered"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(task.spec) }}
                />
              ) : (
                <EmptyState
                  title="No spec yet"
                  description="Write a spec to guide the agent"
                  action={{ label: 'Write Spec', onClick: () => setEditing(true) }}
                />
              )}
            </div>

            <div className="spec-drawer__footer">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onLaunch(task)}
                disabled={task.status === 'active'}
              >
                Launch Agent
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
