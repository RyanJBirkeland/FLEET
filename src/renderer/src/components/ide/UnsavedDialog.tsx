import { useConfirm, ConfirmModal } from '../ui/ConfirmModal'

export interface UnsavedDialogResult {
  confirmUnsaved: (fileName: string) => Promise<boolean>
  confirmProps: ReturnType<typeof useConfirm>['confirmProps']
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUnsavedDialog(): UnsavedDialogResult {
  const { confirm, confirmProps } = useConfirm()

  async function confirmUnsaved(fileName: string): Promise<boolean> {
    return confirm({
      title: 'Unsaved changes',
      message: `"${fileName}" has unsaved changes. Discard them?`,
      confirmLabel: 'Discard',
      variant: 'default'
    })
  }

  return { confirmUnsaved, confirmProps }
}

export { ConfirmModal as UnsavedDialogModal }
