import { useTaskWorkbenchStore } from '../stores/taskWorkbench'
import type { TaskDependency } from '../../../shared/types'
import type { SpecType } from '../../../shared/spec-validation'

const MIN_SPEC_LENGTH_FOR_QUEUE = 50

export interface TaskFormState {
  // Form fields
  title: string
  repo: string
  priority: number
  advancedOpen: boolean
  mode: 'create' | 'edit'
  taskId: string | null
  spec: string
  specType: SpecType | null
  dependsOn: TaskDependency[]
  playgroundEnabled: boolean
  maxCostUsd: number | null
  model: string
  pendingGroupId: string | null
  crossRepoContract: string | null
  // Actions
  setField: (field: string, value: unknown) => void
  resetForm: () => void
  // Derived state
  isDirty: boolean
  isValid: boolean
  canQueue: boolean
}

/**
 * Wraps all useTaskWorkbenchStore selectors for WorkbenchForm and derives
 * isDirty, isValid, and canQueue computed properties.
 */
export function useTaskFormState(): TaskFormState {
  const title = useTaskWorkbenchStore((s) => s.title)
  const repo = useTaskWorkbenchStore((s) => s.repo)
  const priority = useTaskWorkbenchStore((s) => s.priority)
  const advancedOpen = useTaskWorkbenchStore((s) => s.advancedOpen)
  const mode = useTaskWorkbenchStore((s) => s.mode)
  const taskId = useTaskWorkbenchStore((s) => s.taskId)
  const spec = useTaskWorkbenchStore((s) => s.spec)
  const specType = useTaskWorkbenchStore((s) => s.specType)
  const dependsOn = useTaskWorkbenchStore((s) => s.dependsOn)
  const playgroundEnabled = useTaskWorkbenchStore((s) => s.playgroundEnabled)
  const maxCostUsd = useTaskWorkbenchStore((s) => s.maxCostUsd)
  const model = useTaskWorkbenchStore((s) => s.model)
  const pendingGroupId = useTaskWorkbenchStore((s) => s.pendingGroupId)
  const crossRepoContract = useTaskWorkbenchStore((s) => s.crossRepoContract)
  const setField = useTaskWorkbenchStore((s) => s.setField)
  const resetForm = useTaskWorkbenchStore((s) => s.resetForm)
  const isDirtyFn = useTaskWorkbenchStore((s) => s.isDirty)

  const isDirty = isDirtyFn()
  const isValid = Boolean(title.trim()) && Boolean(repo)
  const canQueue = isValid && spec.trim().length >= MIN_SPEC_LENGTH_FOR_QUEUE

  return {
    title,
    repo,
    priority,
    advancedOpen,
    mode,
    taskId,
    spec,
    specType,
    dependsOn,
    playgroundEnabled,
    maxCostUsd,
    model,
    pendingGroupId,
    crossRepoContract,
    setField,
    resetForm,
    isDirty,
    isValid,
    canQueue
  }
}
