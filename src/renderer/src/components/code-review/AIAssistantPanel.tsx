import './AIAssistantPanel.css'
import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, MoreVertical } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { useCodeReviewStore } from '../../stores/codeReview'

export function AIAssistantPanel(): React.JSX.Element {
  const selectedTaskId = useCodeReviewStore((s) => s.selectedTaskId)
  const [showHistory, setShowHistory] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  // Auto-grow textarea
  useEffect(() => {
    if (!textareaRef.current) return
    const textarea = textareaRef.current
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }, [inputValue])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    // TODO: CR Redesign follow-up epic
  }

  const handleChipClick = (action: string): void => {
    console.log('TODO: CR Redesign follow-up epic —', action)
  }

  const handleMenuAction = (action: string): void => {
    if (action === 'show-history') {
      setShowHistory(!showHistory)
    } else {
      console.log('TODO: CR Redesign follow-up epic —', action)
    }
    setMenuOpen(false)
  }

  const rootClass = showHistory ? 'cr-assistant cr-assistant--show-history' : 'cr-assistant'

  return (
    <aside className={rootClass} aria-label="AI Assistant">
      <header className="cr-assistant__header">
        <Sparkles size={12} className="cr-assistant__icon" />
        <span className="cr-assistant__title">AI Assistant</span>
        <div className="cr-assistant__kebab-container" ref={menuRef}>
          <button
            className="cr-assistant__kebab"
            aria-label="Menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div className="cr-assistant__menu" role="menu">
              <button
                role="menuitem"
                onClick={() => handleMenuAction('show-history')}
                className="cr-assistant__menu-item"
              >
                {showHistory ? '✓ ' : ''}Show agent history
              </button>
              <button
                role="menuitem"
                onClick={() => handleMenuAction('clear-thread')}
                className="cr-assistant__menu-item"
              >
                Clear thread
              </button>
              <button
                role="menuitem"
                onClick={() => handleMenuAction('new-thread')}
                className="cr-assistant__menu-item"
              >
                New thread
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="cr-assistant__messages" role="log" aria-live="polite">
        {!selectedTaskId && (
          <div className="cr-assistant__empty">
            <EmptyState message="Select a task to start chatting about its changes." />
          </div>
        )}
      </div>

      <div className="cr-assistant__chips">
        <button onClick={() => handleChipClick('summarize')}>Summarize diff</button>
        <button onClick={() => handleChipClick('risks')}>Risks?</button>
        <button onClick={() => handleChipClick('explain')}>Explain selected file</button>
      </div>

      <form className="cr-assistant__input" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask about this task's changes..."
          rows={1}
        />
        <button type="submit" aria-label="Send message" disabled={!inputValue.trim()}>
          <Send size={14} />
        </button>
      </form>
    </aside>
  )
}
