import { useSprintTasks } from '../../stores/sprintTasks'
import { useCodeReviewStore } from '../../stores/codeReview'
import { renderAgentMarkdown } from '../../lib/render-agent-markdown'

export function ConversationTab(): React.JSX.Element {
  const selectedTaskId = useCodeReviewStore((s) => s.selectedTaskId)
  const tasks = useSprintTasks((s) => s.tasks)
  const task = tasks.find((t) => t.id === selectedTaskId)

  if (!task) return <div className="cr-placeholder">No task selected</div>

  return (
    <div className="cr-conversation">
      <div className="cr-conversation__section">
        <h4 className="cr-conversation__heading">Task Spec</h4>
        <div className="cr-conversation__spec">
          {task.spec ? (
            renderAgentMarkdown(task.spec)
          ) : (
            <span className="cr-placeholder">No spec available</span>
          )}
        </div>
      </div>
      {task.notes && (
        <div className="cr-conversation__section">
          <h4 className="cr-conversation__heading">Agent Notes</h4>
          <div className="cr-conversation__notes">{task.notes}</div>
        </div>
      )}
    </div>
  )
}
