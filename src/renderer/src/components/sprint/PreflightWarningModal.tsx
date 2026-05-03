import React, { useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { usePreflightStore } from '../../stores/preflightStore'

export function PreflightWarningModal(): React.JSX.Element {
  const { queue, enqueue, dequeue } = usePreflightStore()

  useEffect(() => {
    return window.api.agentManager.onPreflightWarning((payload) => {
      enqueue(payload)
    })
  }, [enqueue])

  const current = queue[0]

  async function handleRespond(proceed: boolean): Promise<void> {
    if (!current) return
    await window.api.agentManager.respondToPreflight(current.taskId, proceed)
    dequeue()
  }

  return (
    <Modal
      open={current != null}
      onClose={() => void handleRespond(false)}
      title="Missing toolchain binaries"
      size="md"
      role="alertdialog"
    >
      {current != null && (
        <div className="preflight-warning">
          <p>
            <strong>{current.repoName}</strong> — {current.taskTitle}
          </p>
          <p>The following binaries were not found on PATH or in node_modules/.bin:</p>
          <ul>
            {current.missing.map((b) => (
              <li key={b}>
                <code>{b}</code>
              </li>
            ))}
          </ul>
          <p>The agent will likely fail at its first shell command without these tools installed.</p>
          <div className="preflight-warning__actions">
            <button className="btn btn--default" onClick={() => void handleRespond(false)}>
              Move to backlog
            </button>
            <button className="btn btn--warning" onClick={() => void handleRespond(true)}>
              Proceed anyway
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
