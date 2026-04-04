export interface WorkflowStep {
  title: string
  prompt?: string
  spec?: string
  repo: string
  dependsOnSteps?: number[] // 0-based indices into the workflow steps array
  depType?: 'hard' | 'soft' // defaults to 'hard'
  playgroundEnabled?: boolean
  model?: string
}

export interface WorkflowTemplate {
  name: string
  description: string
  steps: WorkflowStep[]
}
