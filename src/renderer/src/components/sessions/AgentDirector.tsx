import { useState } from 'react'
import { useSessionsStore } from '../../stores/sessions'
import { invokeTool } from '../../lib/rpc'

const STEERING_CHIPS = [
  { id: 'stop', label: 'Stop & summarize' },
  { id: 'pr', label: 'Open a PR' },
  { id: 'continue', label: 'Keep going' },
  { id: 'explain', label: 'Explain last step' }
] as const

interface SentMessage {
  id: string
  text: string
  timestamp: number
}

export function AgentDirector(): React.JSX.Element {
  const selectedKey = useSessionsStore((s) => s.selectedSessionKey)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([])

  const sendMessage = async (text: string): Promise<void> => {
    if (!selectedKey || !text.trim() || sending) return
    setSending(true)
    try {
      await invokeTool('sessions_send', {
        sessionKey: selectedKey,
        message: text.trim()
      })
      setSentMessages((prev) =>
        [
          ...prev,
          { id: `${Date.now()}`, text: text.trim(), timestamp: Date.now() }
        ].slice(-3)
      )
      setInput('')
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
    }
  }

  const handleChip = (label: string): void => {
    sendMessage(label)
  }

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    sendMessage(input)
  }

  if (!selectedKey) {
    return <div className="agent-director agent-director--disabled" />
  }

  return (
    <div className="agent-director">
      <div className="agent-director__header">
        <span className="agent-director__title">Agent Director</span>
      </div>

      <div className="agent-director__chips">
        {STEERING_CHIPS.map((chip) => (
          <button
            key={chip.id}
            className="agent-director__chip"
            onClick={() => handleChip(chip.label)}
            disabled={sending}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <form className="agent-director__form" onSubmit={handleSubmit}>
        <input
          className="agent-director__input"
          type="text"
          placeholder="Send a message to the agent…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button
          className="agent-director__send"
          type="submit"
          disabled={!input.trim() || sending}
        >
          Send
        </button>
      </form>

      {sentMessages.length > 0 && (
        <div className="agent-director__history">
          {sentMessages.map((msg) => (
            <div key={msg.id} className="agent-director__sent">
              {msg.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
