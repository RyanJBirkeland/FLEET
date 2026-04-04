import type { WorkflowTemplate } from '../../shared/workflow-types'
import type { ISprintTaskRepository, CreateTaskInput } from '../data/sprint-task-repository'
import type { SprintTask, TaskDependency } from '../../shared/types'

export interface WorkflowResult {
  tasks: SprintTask[]
  errors: string[]
}

export function instantiateWorkflow(
  template: WorkflowTemplate,
  repo: ISprintTaskRepository
): WorkflowResult {
  const created: SprintTask[] = []
  const errors: string[] = []

  for (let i = 0; i < template.steps.length; i++) {
    const step = template.steps[i]

    // Resolve dependency IDs from step indices
    const dependsOn: TaskDependency[] = []
    if (step.dependsOnSteps) {
      for (const depIdx of step.dependsOnSteps) {
        if (depIdx < 0 || depIdx >= created.length) {
          errors.push(`Step ${i}: dependsOnSteps[${depIdx}] out of range`)
          continue
        }
        dependsOn.push({
          id: created[depIdx].id,
          type: step.depType ?? 'hard'
        })
      }
    }

    const input: CreateTaskInput = {
      title: `[${template.name}] ${step.title}`,
      repo: step.repo,
      prompt: step.prompt,
      spec: step.spec,
      status: dependsOn.length > 0 ? 'blocked' : 'backlog',
      depends_on: dependsOn.length > 0 ? dependsOn : undefined,
      playground_enabled: step.playgroundEnabled,
      model: step.model
    }

    const task = repo.createTask(input)
    if (!task) {
      errors.push(`Step ${i}: createTask failed for "${step.title}"`)
      break // Stop — later steps may depend on this one
    }
    created.push(task)
  }

  return { tasks: created, errors }
}
