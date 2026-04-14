/**
 * MemorySection — file browser and editor for agent memory.
 * Lists memory files from ~/.bde/memory/ via IPC
 * (memory:listFiles, memory:readFile, memory:writeFile). Groups files
 * into pinned (MEMORY.md), daily logs, projects, and other. Keyboard-navigable.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Brain } from 'lucide-react'
import { toast } from '../../stores/toasts'
import './MemorySection.css'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ConfirmModal, useConfirm } from '../ui/ConfirmModal'
import * as memoryService from '../../services/memory'
import { SettingsCard } from './SettingsCard'
import { useMemoryFiles } from './useMemoryFiles'
import { MemoryFileList } from './MemoryFileList'

export function MemorySection(): React.JSX.Element {
  const {
    files,
    loadingFiles,
    activeFiles,
    loadFiles,
    saveFile: saveFileToService,
    createFile: createFileWithService,
    toggleActive,
  } = useMemoryFiles()

  const [loadingContent, setLoadingContent] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [newFilePrompt, setNewFilePrompt] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<memoryService.MemorySearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const { confirm, confirmProps } = useConfirm()

  const isDirty = content !== savedContent

  const openFile = useCallback(async (path: string) => {
    setLoadingContent(true)
    try {
      const text = await memoryService.readFile(path)
      setSelectedPath(path)
      setContent(text)
      setSavedContent(text)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to open file')
    } finally {
      setLoadingContent(false)
    }
  }, [])

  /**
   * Attempt to switch to a new file, showing a confirmation if there are unsaved changes.
   */
  const handleSelectFile = useCallback(
    async (path: string) => {
      if (isDirty) {
        const ok = await confirm({
          title: 'Unsaved changes',
          message: 'You have unsaved changes. Switch files and discard them?',
          confirmLabel: 'Discard & switch',
          variant: 'danger',
        })
        if (!ok) return
      }
      await openFile(path)
    },
    [isDirty, confirm, openFile]
  )

  const saveFile = useCallback(async () => {
    if (!selectedPath) return
    await saveFileToService(selectedPath, content)
    setSavedContent(content)
  }, [selectedPath, content, saveFileToService])

  const discard = useCallback(() => {
    setContent(savedContent)
  }, [savedContent])

  const createFile = useCallback(async () => {
    const name = newFileName.trim()
    if (!name) return
    setCreating(true)
    try {
      await createFileWithService(name, async (path) => {
        setNewFilePrompt(false)
        setNewFileName('')
        await openFile(path)
      })
    } finally {
      setCreating(false)
    }
  }, [newFileName, createFileWithService, openFile])

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)

    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const { results } = await memoryService.search(query)
      setSearchResults(results)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to search memory files')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      // Only intercept Cmd+S when the memory editor textarea is focused
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        if (document.activeElement === editorRef.current) {
          e.preventDefault()
          saveFile()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveFile])

  // Warn browser/Electron on unload when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return
    function onBeforeUnload(e: BeforeUnloadEvent): void {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const activeCount = Object.keys(activeFiles).length
  const activeTotalBytes = useMemo(
    () => files.filter((f) => activeFiles[f.path]).reduce((sum, f) => sum + f.size, 0),
    [files, activeFiles]
  )

  return (
    <SettingsCard title="Agent Memory" subtitle="Browse and edit agent memory files" noPadding>
      <div className="memory-view__content">
        <MemoryFileList
          files={files}
          loadingFiles={loadingFiles}
          selectedPath={selectedPath}
          activeFiles={activeFiles}
          searchQuery={searchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
          onSelectFile={handleSelectFile}
          onLoadFiles={loadFiles}
          onToggleActive={toggleActive}
          onNewFileClick={() => setNewFilePrompt(true)}
          activeCount={activeCount}
          newFilePrompt={newFilePrompt}
          newFileName={newFileName}
          creating={creating}
          onNewFileNameChange={setNewFileName}
          onNewFileSubmit={createFile}
          onNewFileCancel={() => {
            setNewFilePrompt(false)
            setNewFileName('')
          }}
        />

        <div className="memory-editor">
          {loadingContent ? (
            <div className="memory-editor__loading">
              <div className="bde-skeleton memory-editor__skeleton" />
            </div>
          ) : selectedPath ? (
            <>
              <div className="memory-editor__toolbar">
                <span className="memory-editor__path">
                  memory/{selectedPath}
                  {isDirty && <span className="memory-editor__dirty"> &bull;</span>}
                </span>
                {selectedPath && (
                  <button
                    className={`memory-editor__agent-toggle ${activeFiles[selectedPath] ? 'memory-editor__agent-toggle--active' : ''}`}
                    onClick={() => toggleActive(selectedPath)}
                    title={
                      activeFiles[selectedPath]
                        ? 'Remove from agent knowledge'
                        : 'Add to agent knowledge'
                    }
                  >
                    <Brain size={14} />
                    <span>
                      {activeFiles[selectedPath] ? 'Agent Knowledge: On' : 'Agent Knowledge: Off'}
                    </span>
                  </button>
                )}
                <div className="memory-editor__actions">
                  <Button variant="ghost" size="sm" onClick={discard} disabled={!isDirty}>
                    Discard
                  </Button>
                  <Button variant="primary" size="sm" onClick={saveFile} disabled={!isDirty}>
                    Save
                  </Button>
                </div>
              </div>
              {activeCount > 0 && (
                <div
                  className={`memory-editor__size-banner ${activeTotalBytes > 30720 ? 'memory-editor__size-banner--warn' : ''}`}
                >
                  {activeCount} file{activeCount !== 1 ? 's' : ''} active (
                  {(activeTotalBytes / 1024).toFixed(1)} KB total)
                  {activeTotalBytes > 30720 && ' \u2014 Large memory may slow agent responses'}
                </div>
              )}
              <textarea
                ref={editorRef}
                className="memory-editor__textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
              />
            </>
          ) : (
            <EmptyState title="Select a file to view" />
          )}
        </div>
      </div>
      <ConfirmModal {...confirmProps} />
    </SettingsCard>
  )
}
