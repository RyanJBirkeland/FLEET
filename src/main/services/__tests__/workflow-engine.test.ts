import { describe, it, expect, vi } from 'vitest'
import { instantiateWorkflow } from '../workflow-engine'
import type { WorkflowTemplate } from '../../../shared/workflow-types'
import type { ISprintTaskRepository } from '../../data/sprint-task-repository'
import type { SprintTask } from '../../../shared/types'

describe('workflow-engine', () => {
  function createMockRepo(): ISprintTaskRepository {
    let idCounter = 1
    const mockCreateTask = vi.fn((input) => {
      if (!input.title) return null
      return {
        id: `task-${idCounter++}`,
        title: input.title,
        repo: input.repo,
        status: input.status || 'backlog',
        depends_on: input.depends_on || null,
        prompt: input.prompt || null,
        spec: input.spec || null,
        playground_enabled: input.playground_enabled || false,
        model: input.model || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as SprintTask
    })

    return {
      createTask: mockCreateTask,
      getTask: vi.fn(),
      updateTask: vi.fn(),
      getQueuedTasks: vi.fn(),
      getTasksWithDependencies: vi.fn(),
      getOrphanedTasks: vi.fn(),
      getActiveTaskCount: vi.fn(),
      claimTask: vi.fn(),
      listTasks: vi.fn(),
      deleteTask: vi.fn(),
      releaseTask: vi.fn(),
      getQueueStats: vi.fn(),
      getDoneTodayCount: vi.fn(),
      markTaskDoneByPrNumber: vi.fn(),
      markTaskCancelledByPrNumber: vi.fn(),
      listTasksWithOpenPrs: vi.fn(),
      updateTaskMergeableState: vi.fn(),
      getHealthCheckTasks: vi.fn()
    }
  }

  it('should create tasks with no dependencies', () => {
    const template: WorkflowTemplate = {
      name: 'Test Workflow',
      description: 'A simple workflow',
      steps: [
        { title: 'Step 1', repo: 'BDE', spec: 'Do task 1' },
        { title: 'Step 2', repo: 'BDE', prompt: 'Do task 2' }
      ]
    }

    const repo = createMockRepo()
    const result = instantiateWorkflow(template, repo)

    expect(result.errors).toEqual([])
    expect(result.tasks).toHaveLength(2)
    expect(result.tasks[0].title).toBe('[Test Workflow] Step 1')
    expect(result.tasks[0].status).toBe('backlog')
    expect(result.tasks[0].depends_on).toBeNull()
    expect(result.tasks[1].title).toBe('[Test Workflow] Step 2')
    expect(result.tasks[1].status).toBe('backlog')
    expect(result.tasks[1].depends_on).toBeNull()
  })

  it('should create tasks with hard dependencies', () => {
    const template: WorkflowTemplate = {
      name: 'Dependency Test',
      description: 'Test hard dependencies',
      steps: [
        { title: 'Base Task', repo: 'BDE', spec: 'Base' },
        { title: 'Dependent Task', repo: 'BDE', spec: 'Depends on 0', dependsOnSteps: [0] }
      ]
    }

    const repo = createMockRepo()
    const result = instantiateWorkflow(template, repo)

    expect(result.errors).toEqual([])
    expect(result.tasks).toHaveLength(2)
    expect(result.tasks[1].status).toBe('blocked')
    expect(result.tasks[1].depends_on).toEqual([{ id: 'task-1', type: 'hard' }])
  })

  it('should create tasks with soft dependencies', () => {
    const template: WorkflowTemplate = {
      name: 'Soft Dep Test',
      description: 'Test soft dependencies',
      steps: [
        { title: 'Base Task', repo: 'BDE', spec: 'Base' },
        {
          title: 'Soft Dependent',
          repo: 'BDE',
          spec: 'Soft depends on 0',
          dependsOnSteps: [0],
          depType: 'soft'
        }
      ]
    }

    const repo = createMockRepo()
    const result = instantiateWorkflow(template, repo)

    expect(result.errors).toEqual([])
    expect(result.tasks).toHaveLength(2)
    expect(result.tasks[1].status).toBe('blocked')
    expect(result.tasks[1].depends_on).toEqual([{ id: 'task-1', type: 'soft' }])
  })

  it('should handle multiple dependencies', () => {
    const template: WorkflowTemplate = {
      name: 'Multi Dep',
      description: 'Multiple dependencies',
      steps: [
        { title: 'Task A', repo: 'BDE', spec: 'A' },
        { title: 'Task B', repo: 'BDE', spec: 'B' },
        {
          title: 'Task C',
          repo: 'BDE',
          spec: 'C depends on A and B',
          dependsOnSteps: [0, 1]
        }
      ]
    }

    const repo = createMockRepo()
    const result = instantiateWorkflow(template, repo)

    expect(result.errors).toEqual([])
    expect(result.tasks).toHaveLength(3)
    expect(result.tasks[2].depends_on).toEqual([
      { id: 'task-1', type: 'hard' },
      { id: 'task-2', type: 'hard' }
    ])
  })

  it('should report error for out-of-range dependency index', () => {
    const template: WorkflowTemplate = {
      name: 'Invalid Dep',
      description: 'Out of range dependency',
      steps: [
        { title: 'Task A', repo: 'BDE', spec: 'A' },
        {
          title: 'Task B',
          repo: 'BDE',
          spec: 'B depends on non-existent task',
          dependsOnSteps: [5] // Out of range
        }
      ]
    }

    const repo = createMockRepo()
    const result = instantiateWorkflow(template, repo)

    expect(result.errors).toContain('Step 1: dependsOnSteps[5] out of range')
    expect(result.tasks).toHaveLength(2)
    // Task should still be created, just without the invalid dependency
    expect(result.tasks[1].depends_on).toBeNull()
  })

  it('should report error for negative dependency index', () => {
    const template: WorkflowTemplate = {
      name: 'Negative Dep',
      description: 'Negative dependency index',
      steps: [
        { title: 'Task A', repo: 'BDE', spec: 'A' },
        {
          title: 'Task B',
          repo: 'BDE',
          spec: 'B',
          dependsOnSteps: [-1]
        }
      ]
    }

    const repo = createMockRepo()
    const result = instantiateWorkflow(template, repo)

    expect(result.errors).toContain('Step 1: dependsOnSteps[-1] out of range')
  })

  it('should stop on createTask failure', () => {
    const template: WorkflowTemplate = {
      name: 'Fail Test',
      description: 'Test createTask failure',
      steps: [
        { title: 'Task A', repo: 'BDE', spec: 'A' },
        { title: 'Task B', repo: 'BDE', spec: 'B' },
        { title: 'Task C', repo: 'BDE', spec: 'C' }
      ]
    }

    // Create a mock repo that fails on the second task
    const failingRepo: ISprintTaskRepository = {
      createTask: vi.fn((input) => {
        const callCount = (failingRepo.createTask as ReturnType<typeof vi.fn>).mock.calls.length
        if (callCount === 2) return null // Fail on second call
        return {
          id: `task-${callCount}`,
          title: input.title,
          repo: input.repo,
          status: input.status || 'backlog',
          depends_on: input.depends_on || null,
          prompt: input.prompt || null,
          spec: input.spec || null,
          playground_enabled: input.playground_enabled || false,
          model: input.model || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as SprintTask
      }),
      getTask: vi.fn(),
      updateTask: vi.fn(),
      getQueuedTasks: vi.fn(),
      getTasksWithDependencies: vi.fn(),
      getOrphanedTasks: vi.fn(),
      getActiveTaskCount: vi.fn(),
      claimTask: vi.fn(),
      listTasks: vi.fn(),
      deleteTask: vi.fn(),
      releaseTask: vi.fn(),
      getQueueStats: vi.fn(),
      getDoneTodayCount: vi.fn(),
      markTaskDoneByPrNumber: vi.fn(),
      markTaskCancelledByPrNumber: vi.fn(),
      listTasksWithOpenPrs: vi.fn(),
      updateTaskMergeableState: vi.fn(),
      getHealthCheckTasks: vi.fn()
    }

    const result = instantiateWorkflow(template, failingRepo)

    expect(result.errors).toContain('Step 1: createTask failed for "Task B"')
    expect(result.tasks).toHaveLength(1) // Only first task created
  })

  it('should pass through playground_enabled flag', () => {
    const template: WorkflowTemplate = {
      name: 'Playground Test',
      description: 'Test playground flag',
      steps: [{ title: 'Task A', repo: 'BDE', spec: 'A', playgroundEnabled: true }]
    }

    const repo = createMockRepo()
    const result = instantiateWorkflow(template, repo)

    expect(result.errors).toEqual([])
    expect(result.tasks[0].playground_enabled).toBe(true)
  })

  it('should pass through model field', () => {
    const template: WorkflowTemplate = {
      name: 'Model Test',
      description: 'Test model field',
      steps: [{ title: 'Task A', repo: 'BDE', spec: 'A', model: 'opus' }]
    }

    const repo = createMockRepo()
    const result = instantiateWorkflow(template, repo)

    expect(result.errors).toEqual([])
    expect(result.tasks[0].model).toBe('opus')
  })

  it('should handle empty workflow', () => {
    const template: WorkflowTemplate = {
      name: 'Empty',
      description: 'Empty workflow',
      steps: []
    }

    const repo = createMockRepo()
    const result = instantiateWorkflow(template, repo)

    expect(result.errors).toEqual([])
    expect(result.tasks).toHaveLength(0)
  })
})
