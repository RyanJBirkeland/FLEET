/**
 * SessionsView — multi-layout chat interface for agent sessions.
 * Supports single, 2-pane, and grid-4 split modes.
 * Left pane: session list with status dots + model badge.
 * Right pane: layout depends on splitMode.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useVisibilityAwareInterval } from '../hooks/useVisibilityAwareInterval'
import { useSidebarResize } from '../hooks/useSidebarResize'
import { useSessionsKeyboardShortcuts } from '../hooks/useSessionsKeyboardShortcuts'
import { Columns2, Grid2x2, Square, Plus } from 'lucide-react'
import { AgentList } from '../components/sessions/AgentList'
import { SpawnModal } from '../components/sessions/SpawnModal'
import { SessionHeader } from '../components/sessions/SessionHeader'
import { ChatThread } from '../components/sessions/ChatThread'
import { ChatPane } from '../components/sessions/ChatPane'
import { MiniChatPane } from '../components/sessions/MiniChatPane'
import { MessageInput } from '../components/sessions/MessageInput'
import { LocalAgentLogViewer, AgentLogViewer } from '../components/sessions/LocalAgentLogViewer'
import { EmptyState } from '../components/ui/EmptyState'
import { useSessionsStore } from '../stores/sessions'
import { useSplitLayoutStore, type SplitMode } from '../stores/splitLayout'
import { useLocalAgentsStore } from '../stores/localAgents'
import { useAgentHistoryStore } from '../stores/agentHistory'
import { useUIStore } from '../stores/ui'
import type { UnifiedAgent } from '../hooks/useUnifiedAgents'
import { toast } from '../stores/toasts'
import { POLL_SESSIONS_INTERVAL, SEARCH_DEBOUNCE_MS } from '../lib/constants'

const SPLIT_MODES: { mode: SplitMode; icon: typeof Square; title: string }[] = [
  { mode: 'single', icon: Square, title: 'Single pane (⌘⇧1)' },
  { mode: '2-pane', icon: Columns2, title: '2-pane split (⌘⇧2)' },
  { mode: 'grid-4', icon: Grid2x2, title: '2×2 grid (⌘⇧4)' }
]

export function SessionsView(): React.JSX.Element {
  const sessions = useSessionsStore((s) => s.sessions)
  const selectedKey = useSessionsStore((s) => s.selectedSessionKey)
  const selectSession = useSessionsStore((s) => s.selectSession)
  const fetchSessions = useSessionsStore((s) => s.fetchSessions)
  const splitMode = useSplitLayoutStore((s) => s.splitMode)
  const splitPanes = useSplitLayoutStore((s) => s.splitPanes)
  const focusedPaneIndex = useSplitLayoutStore((s) => s.focusedPaneIndex)
  const setFocusedPane = useSplitLayoutStore((s) => s.setFocusedPane)
  const setPaneSession = useSplitLayoutStore((s) => s.setPaneSession)
  const activeView = useUIStore((s) => s.activeView)

  useEffect(() => {
    if (activeView !== 'sessions') return
    fetchSessions()
  }, [fetchSessions, activeView])
  useVisibilityAwareInterval(fetchSessions, activeView === 'sessions' ? POLL_SESSIONS_INTERVAL : null)

  useEffect(() => {
    if (sessions.length > 0 && !selectedKey) {
      selectSession(sessions[0].key)
    }
  }, [sessions, selectedKey, selectSession])

  const { sidebarWidth, onResizeHandleMouseDown } = useSidebarResize()
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [optimisticMessages, setOptimisticMessages] = useState<{ role: 'user'; content: string }[]>([])

  const onBeforeSend = useCallback((message: string) => {
    setOptimisticMessages([{ role: 'user', content: message }])
  }, [])

  const onSent = useCallback(() => {
    setOptimisticMessages([])
    setRefreshTrigger((n) => n + 1)
  }, [])

  const onSendError = useCallback(() => {
    setOptimisticMessages([])
  }, [])

  const subAgents = useSessionsStore((s) => s.subAgents)
  const killSession = useSessionsStore((s) => s.killSession)
  const selectedLocalAgentPid = useLocalAgentsStore((s) => s.selectedLocalAgentPid)
  const selectLocalAgent = useLocalAgentsStore((s) => s.selectLocalAgent)
  const killLocalAgent = useLocalAgentsStore((s) => s.killLocalAgent)
  const selectedHistoryId = useAgentHistoryStore((s) => s.selectedId)
  const selectAgent = useAgentHistoryStore((s) => s.selectAgent)
  const selectedSession = sessions.find((s) => s.key === selectedKey)
  const selectedSubAgent = subAgents.find((a) => a.sessionKey === selectedKey) ?? null

  // Unified agent selection state
  const [selectedUnifiedId, setSelectedUnifiedId] = useState<string | null>(null)

  // Derive send mode + localPid from unified selection
  const localSendPid =
    selectedUnifiedId?.startsWith('local:') ? parseInt(selectedUnifiedId.substring(6), 10) : undefined
  const sessionMode: 'chat' | 'steer' | 'local' =
    localSendPid != null ? 'local' :
    selectedSubAgent ? 'steer' : 'chat'
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), SEARCH_DEBOUNCE_MS)
  }, [])
  const [spawnOpen, setSpawnOpen] = useState(false)

  // FC-S3: Listen for bde:open-spawn-modal from CommandPalette
  useEffect(() => {
    const handler = (): void => setSpawnOpen(true)
    window.addEventListener('bde:open-spawn-modal', handler)
    return () => window.removeEventListener('bde:open-spawn-modal', handler)
  }, [])

  // FC-S7: Sync sidebar selection when agentHistoryStore.selectedId changes externally
  useEffect(() => {
    if (selectedHistoryId) {
      setSelectedUnifiedId(`history:${selectedHistoryId}`)
    }
  }, [selectedHistoryId])

  // Unified selection handler
  const handleUnifiedSelect = useCallback(
    (id: string) => {
      setSelectedUnifiedId(id)
      // Always clear all three stores first, then set the right one
      selectAgent(null)
      selectLocalAgent(null)
      if (id.startsWith('local:')) {
        const pid = parseInt(id.substring(6), 10)
        selectLocalAgent(pid)
      } else if (id.startsWith('history:')) {
        const historyId = id.substring(8)
        selectAgent(historyId)
      } else {
        selectSession(id)
      }
    },
    [selectLocalAgent, selectAgent, selectSession]
  )

  // Unified kill handler
  const handleUnifiedKill = useCallback(
    async (agent: UnifiedAgent) => {
      if (agent.source === 'local' && agent.pid) {
        await killLocalAgent(agent.pid)
        toast.success('Agent killed')
      } else if (agent.sessionKey) {
        await killSession(agent.sessionKey)
        toast.success('Session killed')
      }
    },
    [killLocalAgent, killSession]
  )

  // Unified steer handler
  const handleUnifiedSteer = useCallback(() => {
    window.dispatchEvent(new CustomEvent('bde:focus-message-input'))
  }, [])

  const { handleSplitModeChange } = useSessionsKeyboardShortcuts(selectedKey)

  // Render the main content area based on splitMode
  const renderMainContent = (): React.JSX.Element => {
    // If a history or local agent is selected, always show that regardless of split mode
    if (selectedHistoryId) {
      return <AgentLogViewer agentId={selectedHistoryId} />
    }
    if (selectedLocalAgentPid) {
      return <LocalAgentLogViewer pid={selectedLocalAgentPid} />
    }

    if (splitMode === '2-pane') {
      return (
        <div className="sessions-2pane">
          <div className="sessions-2pane__pane">
            <ChatPane
              paneIndex={0}
              sessionKey={splitPanes[0]}
              isFocused={focusedPaneIndex === 0}
              onFocus={() => setFocusedPane(0)}
              onSessionChange={(key) => setPaneSession(0, key)}
            />
          </div>
          <div className="sessions-2pane__handle" />
          <div className="sessions-2pane__pane">
            <ChatPane
              paneIndex={1}
              sessionKey={splitPanes[1]}
              isFocused={focusedPaneIndex === 1}
              onFocus={() => setFocusedPane(1)}
              onSessionChange={(key) => setPaneSession(1, key)}
            />
          </div>
        </div>
      )
    }

    if (splitMode === 'grid-4') {
      return (
        <div className="sessions-grid4">
          {([0, 1, 2, 3] as const).map((i) => (
            <MiniChatPane
              key={i}
              paneIndex={i}
              sessionKey={splitPanes[i]}
              isFocused={focusedPaneIndex === i}
              onFocus={() => setFocusedPane(i)}
              onSessionChange={(key) => setPaneSession(i, key)}
            />
          ))}
        </div>
      )
    }

    // single mode — original layout
    if (selectedKey && (selectedSession || selectedSubAgent)) {
      return (
        <>
          <SessionHeader session={selectedSession ?? null} subAgent={selectedSubAgent} />
          <div className="sessions-chat__thread">
            <ChatThread
              sessionKey={selectedKey}
              updatedAt={selectedSession?.updatedAt ?? selectedSubAgent?.startedAt ?? 0}
              refreshTrigger={refreshTrigger}
              optimisticMessages={optimisticMessages}
            />
          </div>
          {selectedUnifiedId?.startsWith('history:') ? null : (
            <div className="sessions-chat__input">
              <MessageInput sessionKey={selectedKey} sessionMode={sessionMode} localPid={localSendPid} onSent={onSent} onBeforeSend={onBeforeSend} onSendError={onSendError} />
            </div>
          )}
        </>
      )
    }

    return (
      <EmptyState
        title="Select a session"
        description="Choose a session from the list to start chatting"
      />
    )
  }

  return (
    <div className="sessions-chat">
      <div className="sessions-chat__sidebar" style={{ width: sidebarWidth }}>
        <div className="session-list__header">
          <span className="session-list__title bde-section-title">AGENTS</span>
          <button
            className="session-list__new-btn"
            onClick={() => setSpawnOpen(true)}
            title="Spawn Agent"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="session-list__search">
          <input
            type="text"
            placeholder="Filter agents…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleQueryChange('')
                e.currentTarget.blur()
              }
            }}
          />
        </div>
        <AgentList
          filter={debouncedQuery}
          selectedId={selectedUnifiedId}
          onSelect={handleUnifiedSelect}
          onKill={handleUnifiedKill}
          onSteer={handleUnifiedSteer}
          onSpawn={() => setSpawnOpen(true)}
        />
      </div>
      <div
        className="sessions-view__handle"
        onMouseDown={onResizeHandleMouseDown}
      />
      <div className="sessions-chat__main">
        <div className="sessions-main__topbar">
          {splitMode === 'single' && selectedKey && (
            <span className="sessions-main__session-label">
              {selectedSession?.displayName || selectedSubAgent?.label || selectedKey}
            </span>
          )}
          <div className="sessions-main__topbar-spacer" />
          <div className="sessions-split-toolbar">
            {SPLIT_MODES.map(({ mode, icon: Icon, title }) => (
              <button
                key={mode}
                className={`sessions-split-btn${splitMode === mode ? ' sessions-split-btn--active' : ''}`}
                title={title}
                onClick={() => handleSplitModeChange(mode)}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
        {renderMainContent()}
      </div>
      <SpawnModal open={spawnOpen} onClose={() => setSpawnOpen(false)} />
    </div>
  )
}
