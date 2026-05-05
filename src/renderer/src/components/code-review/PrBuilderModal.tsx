import { Modal } from '../ui/Modal'

interface PrBuilderModalProps {
  open: boolean
  onClose: () => void
}

/**
 * TODO (Task 14): Build out the full PR builder workflow — group selection,
 * stacked-PR ordering, branch name, PR title/body, and submission.
 * This stub satisfies the import contract so Task 13 compiles cleanly.
 */
export function PrBuilderModal({ open, onClose }: PrBuilderModalProps): React.JSX.Element {
  return (
    <Modal open={open} onClose={onClose} title="Build PR" size="md">
      <p style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>
        PR builder coming soon (Task 14).
      </p>
    </Modal>
  )
}
