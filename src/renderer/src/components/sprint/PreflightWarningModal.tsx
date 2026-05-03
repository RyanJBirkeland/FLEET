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

  const hasMissingBinaries = (current?.missing.length ?? 0) > 0
  const hasMissingEnvVars = (current?.missingEnvVars.length ?? 0) > 0

  return (
    <Modal
      open={current != null}
      onClose={() => void handleRespond(false)}
      title="Pre-flight check failed"
      size="md"
      role="alertdialog"
    >
      {current != null && (
        <div className="preflight-warning">
          <p>
            <strong>{current.repoName}</strong> — {current.taskTitle}
          </p>

          {hasMissingBinaries && (
            <>
              <p>The following binaries were not found on PATH or in node_modules/.bin:</p>
              <ul>
                {current.missing.map((b) => (
                  <li key={b}>
                    <code>{b}</code>
                  </li>
                ))}
              </ul>
            </>
          )}

          {hasMissingEnvVars && (
            <>
              <p>The following environment variables referenced in .npmrc are not set:</p>
              <ul>
                {current.missingEnvVars.map((v) => (
                  <li key={v}>
                    <code>{v}</code>
                  </li>
                ))}
              </ul>
              <p className="preflight-warning__hint">
                Configure these in <strong>Settings → Repositories → Environment Variables</strong>.
              </p>
            </>
          )}

          <p>The agent may fail without these in place.</p>
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
