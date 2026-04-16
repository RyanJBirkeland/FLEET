/**
 * WorkbenchPanel — slide-over panel embedding TaskWorkbench inside Task Planner.
 */
import React from 'react'
import { TaskWorkbench } from '../task-workbench/TaskWorkbench'
import './WorkbenchPanel.css'

interface WorkbenchPanelProps {
  open: boolean
  onClose: () => void
}

export function WorkbenchPanel({ open, onClose }: WorkbenchPanelProps): React.JSX.Element | null {
  if (!open) return null
  return (
    <div className="workbench-panel" role="complementary" aria-label="Task editor">
      <div className="workbench-panel__header">
        <h2 className="workbench-panel__title">New Task</h2>
        <button className="workbench-panel__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="workbench-panel__body">
        <TaskWorkbench />
      </div>
    </div>
  )
}
