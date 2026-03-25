import { X } from 'lucide-react'

interface HeaderTabProps {
  label: string
  isActive: boolean
  showDot?: boolean
  showClose?: boolean
  onClick: () => void
  onClose: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}

export function HeaderTab({
  label,
  isActive,
  showDot = false,
  showClose = true,
  onClick,
  onClose,
  draggable = false,
  onDragStart,
}: HeaderTabProps): React.JSX.Element {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClose()
  }

  const className = isActive ? 'header-tab header-tab--active' : 'header-tab'

  return (
    <div
      className={className}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      {showDot && <div className="header-tab__dot" />}
      <span>{label}</span>
      {showClose && (
        <div className="header-tab__close" onClick={handleClose}>
          <X size={11} />
        </div>
      )}
    </div>
  )
}
