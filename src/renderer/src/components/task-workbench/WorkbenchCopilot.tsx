import { useCallback, useEffect, useRef, useState } from 'react'
import { useTaskWorkbenchStore, type CopilotMessage } from '../../stores/taskWorkbench'

interface WorkbenchCopilotProps {
  onClose: () => void
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ msg, onInsert }: { msg: CopilotMessage; onInsert?: () => void }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  const className = `wb-copilot__bubble ${
    isUser
      ? 'wb-copilot__bubble--user'
      : isSystem
        ? 'wb-copilot__bubble--system'
        : 'wb-copilot__bubble--assistant'
  }`

  return (
    <div className={className}>
      <div>{msg.content}</div>
      <div className="wb-copilot__bubble-footer">
        <span className="wb-copilot__time">{formatTime(msg.timestamp)}</span>
        {msg.insertable && onInsert && (
          <button onClick={onInsert} className="wb-copilot__insert-btn">
            Insert into spec
          </button>
        )}
      </div>
    </div>
  )
}

export function WorkbenchCopilot({ onClose }: WorkbenchCopilotProps) {
  const messages = useTaskWorkbenchStore((s) => s.copilotMessages)
  const loading = useTaskWorkbenchStore((s) => s.copilotLoading)
  const addMessage = useTaskWorkbenchStore((s) => s.addCopilotMessage)
  const title = useTaskWorkbenchStore((s) => s.title)
  const repo = useTaskWorkbenchStore((s) => s.repo)
  const spec = useTaskWorkbenchStore((s) => s.spec)
  const setField = useTaskWorkbenchStore((s) => s.setField)

  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const activeStreamIdRef = useRef<string | null>(null)

  // Subscribe to streaming chunks
  useEffect(() => {
    const store = useTaskWorkbenchStore.getState
    const unsub = window.api.workbench.onChatChunk((data) => {
      if (data.streamId !== activeStreamIdRef.current) return

      if (!data.done) {
        store().appendToStreamingMessage(data.chunk)
      } else {
        if (data.error) {
          // Replace streaming message content with error
          const msgId = store().streamingMessageId
          if (msgId) {
            useTaskWorkbenchStore.setState((s) => ({
              copilotMessages: s.copilotMessages.map((m) =>
                m.id === msgId ? { ...m, content: `Error: ${data.error}` } : m
              )
            }))
          }
          store().finishStreaming(false)
        } else {
          store().finishStreaming(true)
        }
        activeStreamIdRef.current = null
      }
    })
    return unsub
  }, [])

  // Auto-scroll on new messages and streaming content
  const streamingId = useTaskWorkbenchStore((s) => s.streamingMessageId)
  const streamingContent = messages.find((m) => m.id === streamingId)?.content?.length ?? 0

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, loading, streamingContent])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    addMessage({ id: `user-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() })

    const allMessages = [...useTaskWorkbenchStore.getState().copilotMessages]
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))
    allMessages.push({ role: 'user', content: text })

    // Create empty assistant message for streaming
    const msgId = `assistant-${Date.now()}`
    addMessage({ id: msgId, role: 'assistant', content: '', timestamp: Date.now() })

    try {
      const { streamId } = await window.api.workbench.chatStream({
        messages: allMessages,
        formContext: { title, repo, spec }
      })
      activeStreamIdRef.current = streamId
      useTaskWorkbenchStore.getState().startStreaming(msgId, streamId)
    } catch {
      // If we can't even start the stream, show error
      useTaskWorkbenchStore.setState((s) => ({
        copilotMessages: s.copilotMessages.map((m) =>
          m.id === msgId
            ? { ...m, content: 'Failed to reach Claude. Check your connection and try again.' }
            : m
        ),
        copilotLoading: false
      }))
    }
  }, [input, loading, title, repo, spec, addMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleInsert = useCallback(
    (msg: CopilotMessage) => {
      const current = useTaskWorkbenchStore.getState().spec
      const separator = current.trim() ? '\n\n' : ''
      setField('spec', current + separator + msg.content)
    },
    [setField]
  )

  const sendDisabled = !input.trim() || loading

  return (
    <div className="wb-copilot">
      {/* Header */}
      <div className="wb-copilot__header">
        <span className="wb-copilot__title">AI Copilot</span>
        <button onClick={onClose} className="wb-copilot__close" title="Close copilot">
          ×
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="wb-copilot__messages">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onInsert={msg.insertable ? () => handleInsert(msg) : undefined}
          />
        ))}
        {loading && (
          <div className="wb-copilot__loading">
            <span className="wb-copilot__loading-text">
              {useTaskWorkbenchStore.getState().streamingMessageId ? 'Streaming...' : 'Thinking...'}
            </span>
            <button
              onClick={() => {
                const sid = useTaskWorkbenchStore.getState().activeStreamId
                if (sid) {
                  window.api.workbench.cancelStream(sid)
                  useTaskWorkbenchStore.getState().finishStreaming(true)
                }
              }}
              className="wb-copilot__cancel-btn"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="wb-copilot__input-row">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about the codebase, brainstorm approaches..."
          rows={2}
          className="wb-copilot__input"
        />
        <button
          onClick={handleSend}
          disabled={sendDisabled}
          className={`wb-copilot__send-btn ${sendDisabled ? 'wb-copilot__send-btn--disabled' : 'wb-copilot__send-btn--active'}`}
        >
          Send
        </button>
      </div>
    </div>
  )
}
