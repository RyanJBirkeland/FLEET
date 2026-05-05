import { FolderOpen } from 'lucide-react'
import { useIDEStore } from '../../stores/ide'
import { toast } from '../../stores/toasts'

export interface IDEEmptyStateProps {
  onOpenFolder: () => void
}

export function IDEEmptyState({ onOpenFolder }: IDEEmptyStateProps): React.JSX.Element {
  const recentFolders = useIDEStore((s) => s.recentFolders)
  const setRootPath = useIDEStore((s) => s.setRootPath)

  async function handleRecentFolder(folderPath: string): Promise<void> {
    try {
      const result = await window.api.fs.watchDir(folderPath)
      if (result && 'success' in result && !result.success) {
        throw new Error(result.error || 'Failed to watch directory')
      }
      setRootPath(folderPath)
    } catch (err) {
      toast.error(
        `Failed to open "${folderPath}": ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 'var(--s-3)',
        color: 'var(--fg-3)',
      }}
    >
      <span className="fleet-eyebrow">NO WORKSPACE</span>
      <p style={{ margin: 0, fontSize: 'var(--t-sm)', color: 'var(--fg-3)' }}>
        Open a folder to start editing.
      </p>
      <div style={{ marginTop: 'var(--s-2)' }}>
        <button
          onClick={onOpenFolder}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--s-2)',
            padding: 'var(--s-2) var(--s-4)',
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent-line)',
            borderRadius: 'var(--r-md)',
            color: 'var(--fg)',
            fontSize: 'var(--t-sm)',
            cursor: 'pointer',
          }}
        >
          <FolderOpen size={14} />
          Open Folder
        </button>
      </div>
      {recentFolders.length > 0 && (
        <div
          style={{
            marginTop: 'var(--s-4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--s-1)',
            maxWidth: 360,
            width: '100%',
          }}
        >
          <span className="fleet-eyebrow">RECENT</span>
          {recentFolders.map((folder) => (
            <button
              key={folder}
              onClick={() => void handleRecentFolder(folder)}
              title={folder}
              style={{
                width: '100%',
                padding: 'var(--s-2) var(--s-3)',
                background: 'transparent',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-sm)',
                color: 'var(--fg-3)',
                fontSize: 'var(--t-xs)',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'left',
              }}
            >
              {folder}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
