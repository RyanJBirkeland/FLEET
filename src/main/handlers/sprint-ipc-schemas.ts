import { z } from 'zod'
import { TaskWriteFieldsSchema, TaskDependencySchema } from '../mcp-server/schemas'

// Re-export so callers that only need the dependency shape can import from one place.
export { TaskDependencySchema }

/**
 * Validates the shape of `sprint:create` IPC payloads.
 * Extends TaskWriteFieldsSchema with IPC-only fields (model) and overrides
 * error messages to match the human-readable format callers expect.
 */
export const CreateTaskInputSchema = TaskWriteFieldsSchema.extend({
  title: z.string().min(1, 'task.title must be a non-empty string'),
  repo: z.string().min(1, 'task.repo must be a non-empty string'),
  model: z.string().optional()
})

// --- Workflow schemas -------------------------------------------------------

export const WorkflowStepSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().optional(),
  spec: z.string().optional(),
  repo: z.string().min(1),
  dependsOnSteps: z.array(z.number().int().min(0)).optional(),
  depType: z.enum(['hard', 'soft']).optional(),
  playgroundEnabled: z.boolean().optional(),
  model: z.string().optional()
})

export const WorkflowTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  steps: z.array(WorkflowStepSchema).min(1)
})

// --- Batch import schema ----------------------------------------------------

export const BatchImportTaskSchema = z.object({
  title: z.string().min(1),
  repo: z.string().min(1),
  prompt: z.string().optional(),
  spec: z.string().optional(),
  status: z.string().optional(),
  dependsOnIndices: z.array(z.number().int().min(0)).optional(),
  depType: z.enum(['hard', 'soft']).optional(),
  playgroundEnabled: z.boolean().optional(),
  model: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  templateName: z.string().optional()
})
