import { useCallback, useRef, useEffect } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { useTaskWorkbenchStore } from '../../stores/taskWorkbench'
import { WorkbenchForm } from './WorkbenchForm'
import { WorkbenchCopilot } from './WorkbenchCopilot'
import '../../assets/task-workbench-neon.css'

export function TaskWorkbench(): React.JSX.Element {
  const copilotVisible = useTaskWorkbenchStore((s) => s.copilotVisible)
  const toggleCopilot = useTaskWorkbenchStore((s) => s.toggleCopilot)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      const store = useTaskWorkbenchStore.getState()
      if (width < 600 && store.copilotVisible) {
        store.toggleCopilot()
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const addMessage = useTaskWorkbenchStore((s) => s.addCopilotMessage)
  const title = useTaskWorkbenchStore((s) => s.title)
  const repo = useTaskWorkbenchStore((s) => s.repo)
  const spec = useTaskWorkbenchStore((s) => s.spec)

  const handleSendFromForm = useCallback(
    async (text: string) => {
      // If copilot is hidden, show it so the streaming listener is mounted
      if (!useTaskWorkbenchStore.getState().copilotVisible) {
        toggleCopilot()
      }

      // Add user message
      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: text,
        timestamp: Date.now()
      }
      addMessage(userMsg)

      // Create empty assistant message and start streaming state
      const msgId = `assistant-${Date.now()}`
      addMessage({
        id: msgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        insertable: true
      })
      useTaskWorkbenchStore.getState().startStreaming(msgId, '') // placeholder streamId

      try {
        await window.api.workbench.chatStream({
          messages: [{ role: 'user', content: text }],
          formContext: { title, repo, spec }
        })
        // Real streamId is set by the WorkbenchCopilot chunk listener
      } catch {
        useTaskWorkbenchStore.setState((s) => ({
          copilotMessages: s.copilotMessages.map((m) =>
            m.id === msgId
              ? { ...m, content: 'Failed to reach Claude. Check your connection and try again.' }
              : m
          ),
          copilotLoading: false,
          streamingMessageId: null,
          activeStreamId: null
        }))
      }
    },
    [title, repo, spec, toggleCopilot, addMessage]
  )

  return (
    <div ref={containerRef} className="wb">
      {/* Toggle copilot button when hidden */}
      {!copilotVisible && (
        <div className="wb__copilot-toggle">
          <button onClick={toggleCopilot}>AI Copilot</button>
        </div>
      )}

      <Group orientation="horizontal" style={{ flex: 1 }}>
        <Panel defaultSize={copilotVisible ? 65 : 100} minSize={40}>
          <WorkbenchForm onSendCopilotMessage={handleSendFromForm} />
        </Panel>

        {copilotVisible && (
          <>
            <Separator className="wb__separator" />
            <Panel defaultSize={35} minSize={20}>
              <WorkbenchCopilot onClose={toggleCopilot} />
            </Panel>
          </>
        )}
      </Group>
    </div>
  )
}
