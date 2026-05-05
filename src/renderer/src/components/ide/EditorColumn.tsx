import type * as Monaco from 'monaco-editor'
import { useShallow } from 'zustand/react/shallow'
import { useIDEStore } from '../../stores/ide'
import { useIDEFileCache } from '../../stores/ideFileCache'
import { TabStrip } from './TabStrip'
import { ContextBar } from './ContextBar'
import { EditorPane } from './EditorPane'
import { TerminalPanel } from './TerminalPanel'

export interface EditorColumnProps {
  terminalOpen: boolean
  insightOpen: boolean
  onToggleTerminal: () => void
  onToggleInsight: () => void
  onCloseTab: (tabId: string, isDirty: boolean) => void
  onNewFile?: (() => void) | undefined
  editorRef: React.RefObject<Monaco.editor.IStandaloneCodeEditor | null>
  onContentChange?: ((content: string) => void) | undefined
  onSave?: (() => void) | undefined
}

export function EditorColumn({
  terminalOpen,
  insightOpen,
  onToggleTerminal,
  onToggleInsight,
  onCloseTab,
  onNewFile,
  editorRef,
  onContentChange,
  onSave
}: EditorColumnProps): React.JSX.Element {
  const { tabs, activeTabId, setActiveTab, minimapEnabled, wordWrapEnabled, fontSize } =
    useIDEStore(
      useShallow((s) => ({
        tabs: s.openTabs,
        activeTabId: s.activeTabId,
        setActiveTab: s.setActiveTab,
        minimapEnabled: s.minimapEnabled,
        wordWrapEnabled: s.wordWrapEnabled,
        fontSize: s.fontSize
      }))
    )

  const fileContents = useIDEFileCache((s) => s.fileContents)
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const activeContent = activeTab ? (fileContents[activeTab.filePath] ?? null) : null

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)'
      }}
    >
      <TabStrip
        tabs={tabs}
        activeTabId={activeTabId}
        onActivate={setActiveTab}
        onClose={onCloseTab}
        onNewFile={onNewFile}
      />
      <ContextBar
        activeTabId={activeTabId}
        terminalOpen={terminalOpen}
        insightOpen={insightOpen}
        onToggleTerminal={onToggleTerminal}
        onToggleInsight={onToggleInsight}
      />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <EditorPane
          filePath={activeTab?.filePath ?? null}
          content={activeContent}
          language={activeTab?.language ?? 'plaintext'}
          onContentChange={onContentChange}
          onSave={onSave}
          minimapEnabled={minimapEnabled}
          wordWrapEnabled={wordWrapEnabled}
          fontSize={fontSize}
          editorRef={editorRef}
        />
      </div>
      {terminalOpen && <TerminalPanel />}
    </div>
  )
}
