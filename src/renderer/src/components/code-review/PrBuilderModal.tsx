import { useState, useCallback } from 'react'
import { Modal } from '../ui/Modal'
import { usePrGroups } from '../../hooks/usePrGroups'
import type { PrGroup, SprintTask } from '../../../../shared/types/task-types'
import './PrBuilderModal.css'

interface PrBuilderModalProps {
  open: boolean
  repo: string
  onClose: () => void
}

export function PrBuilderModal({ open, repo, onClose }: PrBuilderModalProps): React.JSX.Element {
  const {
    groups,
    buildingGroupIds,
    unassignedTasksForRepo,
    createGroup,
    updateGroup,
    addTask,
    removeTask,
    buildGroup,
    deleteGroup,
  } = usePrGroups(repo)

  const handleDrop = useCallback(
    async (groupId: string, taskId: string) => {
      await addTask(groupId, taskId)
    },
    [addTask]
  )

  const handleNewGroup = useCallback(async () => {
    const date = new Date().toISOString().slice(0, 10)
    await createGroup(`PR ${date}`, `feat/pr-${Date.now()}`)
  }, [createGroup])

  return (
    <Modal open={open} onClose={onClose} size="lg" title="PR Builder">
      <div className="pr-builder">
        <UnassignedTaskPool tasks={unassignedTasksForRepo} />
        <PrGroupList
          groups={groups}
          buildingGroupIds={buildingGroupIds}
          onNewGroup={handleNewGroup}
          onDrop={handleDrop}
          onUpdateGroup={updateGroup}
          onRemoveTask={removeTask}
          onBuild={buildGroup}
          onDelete={deleteGroup}
        />
      </div>
    </Modal>
  )
}

// ── UnassignedTaskPool ───────────────────────────────────────────────────────

function UnassignedTaskPool({ tasks }: { tasks: SprintTask[] }): React.JSX.Element {
  return (
    <aside className="pr-builder__pool">
      <h3 className="pr-builder__panel-title">
        Unassigned Tasks
        <span className="pr-builder__count">{tasks.length}</span>
      </h3>
      {tasks.length === 0 ? (
        <p className="pr-builder__empty">No unassigned approved tasks</p>
      ) : (
        <ul className="pr-builder__task-list">
          {tasks.map((task) => (
            <UnassignedTaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </aside>
  )
}

function UnassignedTaskRow({ task }: { task: SprintTask }): React.JSX.Element {
  return (
    <li
      className="pr-builder__pool-task"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id)
      }}
    >
      <span className="pr-builder__task-title">{task.title}</span>
    </li>
  )
}

// ── PrGroupList ──────────────────────────────────────────────────────────────

interface PrGroupListProps {
  groups: PrGroup[]
  buildingGroupIds: Set<string>
  onNewGroup: () => Promise<void>
  onDrop: (groupId: string, taskId: string) => Promise<void>
  onUpdateGroup: (
    id: string,
    updates: { title?: string; branchName?: string; description?: string }
  ) => Promise<void>
  onRemoveTask: (groupId: string, taskId: string) => Promise<void>
  onBuild: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function PrGroupList({
  groups,
  buildingGroupIds,
  onNewGroup,
  onDrop,
  onUpdateGroup,
  onRemoveTask,
  onBuild,
  onDelete,
}: PrGroupListProps): React.JSX.Element {
  return (
    <main className="pr-builder__groups">
      <div className="pr-builder__groups-header">
        <h3 className="pr-builder__panel-title">PR Groups</h3>
        <button className="pr-builder__new-group-btn" onClick={onNewGroup}>
          + New Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="pr-builder__empty-groups">
          No PR groups yet. Create a group or drag a task here.
        </div>
      ) : (
        groups.map((group) => (
          <PrGroupCard
            key={group.id}
            group={group}
            building={buildingGroupIds.has(group.id)}
            onDrop={onDrop}
            onUpdateGroup={onUpdateGroup}
            onRemoveTask={onRemoveTask}
            onBuild={onBuild}
            onDelete={onDelete}
          />
        ))
      )}
    </main>
  )
}

// ── PrGroupCard ──────────────────────────────────────────────────────────────

interface PrGroupCardProps {
  group: PrGroup
  building: boolean
  onDrop: (groupId: string, taskId: string) => Promise<void>
  onUpdateGroup: (
    id: string,
    updates: { title?: string; branchName?: string; description?: string }
  ) => Promise<void>
  onRemoveTask: (groupId: string, taskId: string) => Promise<void>
  onBuild: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function PrGroupCard({
  group,
  building,
  onDrop,
  onUpdateGroup,
  onRemoveTask,
  onBuild,
  onDelete,
}: PrGroupCardProps): React.JSX.Element {
  const [dragOver, setDragOver] = useState(false)

  const canBuild = group.task_order.length > 0 && group.status === 'composing' && !building

  const taskCountLabel =
    group.task_order.length === 1 ? '1 task' : `${group.task_order.length} tasks`

  const buildButtonLabel = building
    ? 'Building PR…'
    : group.status === 'open'
      ? 'PR Open ↗'
      : 'Build PR'

  return (
    <div
      className={`pr-group-card${dragOver ? ' pr-group-card--drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (e) => {
        e.preventDefault()
        setDragOver(false)
        const taskId = e.dataTransfer.getData('text/plain')
        if (taskId) await onDrop(group.id, taskId)
      }}
    >
      <div className="pr-group-card__header">
        <span className="pr-group-card__badge">{taskCountLabel}</span>
        <button
          className="pr-group-card__delete-btn"
          onClick={() => onDelete(group.id)}
          disabled={building}
          aria-label="Delete group"
        >
          ×
        </button>
      </div>

      <TaskOrderList
        taskOrder={group.task_order}
        groupId={group.id}
        onRemoveTask={onRemoveTask}
      />

      <PrGroupFields
        group={group}
        onUpdateGroup={onUpdateGroup}
      />

      <button
        className="pr-group-card__build-btn"
        onClick={() => onBuild(group.id)}
        disabled={!canBuild}
      >
        {buildButtonLabel}
      </button>

      {group.pr_url && group.status === 'open' && (
        <a
          href={group.pr_url}
          target="_blank"
          rel="noreferrer"
          className="pr-group-card__pr-link"
          onClick={(e) => {
            e.preventDefault()
            window.open(group.pr_url!, '_blank')
          }}
        >
          View PR →
        </a>
      )}
    </div>
  )
}

// ── TaskOrderList ────────────────────────────────────────────────────────────

interface TaskOrderListProps {
  taskOrder: string[]
  groupId: string
  onRemoveTask: (groupId: string, taskId: string) => Promise<void>
}

function TaskOrderList({ taskOrder, groupId, onRemoveTask }: TaskOrderListProps): React.JSX.Element {
  return (
    <ul className="pr-group-card__tasks">
      {taskOrder.length === 0 ? (
        <li className="pr-group-card__drop-hint">Drop tasks here</li>
      ) : (
        taskOrder.map((taskId) => (
          <li key={taskId} className="pr-group-card__task-row">
            <span className="pr-group-card__task-id">{taskId.slice(0, 8)}</span>
            <button
              className="pr-group-card__remove-task"
              onClick={() => onRemoveTask(groupId, taskId)}
              aria-label="Remove from group"
            >
              ↩
            </button>
          </li>
        ))
      )}
    </ul>
  )
}

// ── PrGroupFields ────────────────────────────────────────────────────────────

interface PrGroupFieldsProps {
  group: PrGroup
  onUpdateGroup: (
    id: string,
    updates: { title?: string; branchName?: string; description?: string }
  ) => Promise<void>
}

function PrGroupFields({ group, onUpdateGroup }: PrGroupFieldsProps): React.JSX.Element {
  return (
    <div className="pr-group-card__fields">
      <input
        className="pr-group-card__input"
        placeholder="PR title"
        defaultValue={group.title}
        onBlur={(e) => onUpdateGroup(group.id, { title: e.target.value })}
      />
      <input
        className="pr-group-card__input"
        placeholder="Branch name"
        defaultValue={group.branch_name}
        onBlur={(e) => onUpdateGroup(group.id, { branchName: e.target.value })}
      />
      <textarea
        className="pr-group-card__textarea"
        placeholder="PR description (optional)"
        defaultValue={group.description ?? ''}
        onBlur={(e) => onUpdateGroup(group.id, { description: e.target.value })}
        rows={3}
      />
    </div>
  )
}
