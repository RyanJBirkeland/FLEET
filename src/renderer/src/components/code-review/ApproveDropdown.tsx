import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type JSX } from 'react'

interface Props {
  onMergeLocally: () => void
  onSquashMerge: () => void
  onCreatePR: () => void
  onRequestRevision: () => void
  onDiscard: () => void
  disabled?: boolean
}

export function ApproveDropdown({
  onMergeLocally,
  onSquashMerge,
  onCreatePR,
  onRequestRevision,
  onDiscard,
  disabled = false,
}: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }
    function onClick(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  function run(fn: () => void): void {
    fn()
    setOpen(false)
  }

  return (
    <div className="cr-approve" ref={rootRef}>
      <button
        type="button"
        className="cr-approve__trigger"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Check size={14} />
        <span>Approve</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="cr-approve__menu" role="menu">
          <button type="button" role="menuitem" onClick={() => run(onMergeLocally)}>
            Merge Locally
          </button>
          <button type="button" role="menuitem" onClick={() => run(onSquashMerge)}>
            Squash & Merge
          </button>
          <button type="button" role="menuitem" onClick={() => run(onCreatePR)}>
            Create PR
          </button>
          <hr className="cr-approve__divider" />
          <button type="button" role="menuitem" onClick={() => run(onRequestRevision)}>
            Request Revision
          </button>
          <button
            type="button"
            role="menuitem"
            className="cr-approve__danger"
            onClick={() => run(onDiscard)}
          >
            Discard
          </button>
        </div>
      )}
    </div>
  )
}
