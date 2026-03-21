/**
 * Sprint task query functions — Supabase edition.
 * All functions are async and use the Supabase client singleton.
 */
import type { SprintTask } from '../../shared/types'
import { getSupabaseClient } from './supabase-client'

// --- Field allowlist for updates ---

export const UPDATE_ALLOWLIST = new Set([
  'title',
  'prompt',
  'repo',
  'status',
  'priority',
  'spec',
  'notes',
  'pr_url',
  'pr_number',
  'pr_status',
  'pr_mergeable_state',
  'agent_run_id',
  'retry_count',
  'fast_fail_count',
  'started_at',
  'completed_at',
  'template_name',
  'claimed_by',
])

export interface QueueStats {
  [key: string]: number
  backlog: number
  queued: number
  active: number
  done: number
  failed: number
  cancelled: number
  error: number
}

export async function getTask(id: string): Promise<SprintTask | null> {
  const { data, error } = await getSupabaseClient()
    .from('sprint_tasks')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.warn(`[sprint-queries] getTask failed for id=${id}:`, error)
    return null
  }
  return data as SprintTask | null
}

export async function listTasks(status?: string): Promise<SprintTask[]> {
  let query = getSupabaseClient()
    .from('sprint_tasks')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) {
    console.warn('[sprint-queries] listTasks failed:', error)
    return []
  }
  return (data ?? []) as SprintTask[]
}

export interface CreateTaskInput {
  title: string
  repo: string
  prompt?: string
  notes?: string
  spec?: string
  priority?: number
  status?: string
  template_name?: string
}

export async function createTask(input: CreateTaskInput): Promise<SprintTask> {
  const { data, error } = await getSupabaseClient()
    .from('sprint_tasks')
    .insert({
      title: input.title,
      repo: input.repo,
      prompt: input.prompt ?? input.spec ?? input.title,
      spec: input.spec ?? null,
      notes: input.notes ?? null,
      priority: input.priority ?? 0,
      status: input.status ?? 'backlog',
      template_name: input.template_name ?? null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`[sprint-queries] createTask failed: ${error.message}`)
  }
  return data as SprintTask
}

export async function updateTask(
  id: string,
  patch: Record<string, unknown>
): Promise<SprintTask | null> {
  const entries = Object.entries(patch).filter(([k]) => UPDATE_ALLOWLIST.has(k))
  if (entries.length === 0) return null

  const updateObj: Record<string, unknown> = {}
  for (const [k, v] of entries) {
    updateObj[k] = v
  }

  const { data, error } = await getSupabaseClient()
    .from('sprint_tasks')
    .update(updateObj)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.warn(`[sprint-queries] updateTask failed for id=${id}:`, error)
    return null
  }
  return data as SprintTask
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('sprint_tasks')
    .delete()
    .eq('id', id)

  if (error) {
    console.warn(`[sprint-queries] deleteTask failed for id=${id}:`, error)
  }
}

export async function claimTask(
  id: string,
  claimedBy: string
): Promise<SprintTask | null> {
  const now = new Date().toISOString()
  const { data, error } = await getSupabaseClient()
    .from('sprint_tasks')
    .update({ status: 'active', claimed_by: claimedBy, started_at: now })
    .eq('id', id)
    .eq('status', 'queued')
    .select()
    .single()

  if (error) {
    // No matching row (not queued or doesn't exist) is not a real error
    return null
  }
  return data as SprintTask
}

export async function releaseTask(id: string): Promise<SprintTask | null> {
  const { data, error } = await getSupabaseClient()
    .from('sprint_tasks')
    .update({ status: 'queued', claimed_by: null, started_at: null, agent_run_id: null })
    .eq('id', id)
    .eq('status', 'active')
    .select()
    .single()

  if (error) {
    return null
  }
  return data as SprintTask
}

export async function getQueueStats(): Promise<QueueStats> {
  const stats: QueueStats = {
    backlog: 0,
    queued: 0,
    active: 0,
    done: 0,
    failed: 0,
    cancelled: 0,
    error: 0,
  }

  // Supabase doesn't have native GROUP BY in the client — fetch statuses
  const { data, error } = await getSupabaseClient()
    .from('sprint_tasks')
    .select('status')

  if (error) {
    console.warn('[sprint-queries] getQueueStats failed:', error)
    return stats
  }

  for (const row of data ?? []) {
    const s = (row as { status: string }).status
    if (s in stats) {
      stats[s as keyof QueueStats]++
    }
  }
  return stats
}

export async function getDoneTodayCount(): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count, error } = await getSupabaseClient()
    .from('sprint_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'done')
    .gte('completed_at', today.toISOString())

  if (error) {
    console.warn('[sprint-queries] getDoneTodayCount failed:', error)
    return 0
  }
  return count ?? 0
}

export async function markTaskDoneByPrNumber(prNumber: number): Promise<void> {
  try {
    const completedAt = new Date().toISOString()
    // Transition active tasks to done
    await getSupabaseClient()
      .from('sprint_tasks')
      .update({ status: 'done', completed_at: completedAt })
      .eq('pr_number', prNumber)
      .eq('status', 'active')

    // Also update pr_status to merged for tasks already marked done
    await getSupabaseClient()
      .from('sprint_tasks')
      .update({ pr_status: 'merged' })
      .eq('pr_number', prNumber)
      .eq('status', 'done')
      .eq('pr_status', 'open')
  } catch (err) {
    console.warn(`[sprint-queries] failed to mark task done for PR #${prNumber}:`, err)
  }
}

export async function markTaskCancelledByPrNumber(prNumber: number): Promise<void> {
  try {
    // Transition active tasks to cancelled
    await getSupabaseClient()
      .from('sprint_tasks')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('pr_number', prNumber)
      .eq('status', 'active')

    // Also update pr_status to closed for tasks already marked done
    await getSupabaseClient()
      .from('sprint_tasks')
      .update({ pr_status: 'closed' })
      .eq('pr_number', prNumber)
      .eq('status', 'done')
      .eq('pr_status', 'open')
  } catch (err) {
    console.warn(`[sprint-queries] failed to mark task cancelled for PR #${prNumber}:`, err)
  }
}

export async function listTasksWithOpenPrs(): Promise<SprintTask[]> {
  const { data, error } = await getSupabaseClient()
    .from('sprint_tasks')
    .select('*')
    .not('pr_number', 'is', null)
    .eq('pr_status', 'open')

  if (error) {
    console.warn('[sprint-queries] listTasksWithOpenPrs failed:', error)
    return []
  }
  return (data ?? []) as SprintTask[]
}

export async function updateTaskMergeableState(
  prNumber: number,
  mergeableState: string | null
): Promise<void> {
  if (!mergeableState) return
  try {
    await getSupabaseClient()
      .from('sprint_tasks')
      .update({ pr_mergeable_state: mergeableState })
      .eq('pr_number', prNumber)
  } catch (err) {
    console.warn(
      `[sprint-queries] failed to update mergeable_state for PR #${prNumber}:`,
      err
    )
  }
}

export async function getQueuedTasks(): Promise<SprintTask[]> {
  const { data, error } = await getSupabaseClient()
    .from('sprint_tasks')
    .select('*')
    .eq('status', 'queued')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('[sprint-queries] getQueuedTasks failed:', error)
    return []
  }
  return (data ?? []) as SprintTask[]
}

export async function clearSprintTaskFk(agentRunId: string): Promise<void> {
  try {
    await getSupabaseClient()
      .from('sprint_tasks')
      .update({ agent_run_id: null })
      .eq('agent_run_id', agentRunId)
  } catch (err) {
    console.warn(
      `[sprint-queries] failed to clear FK for agent_run_id=${agentRunId}:`,
      err
    )
  }
}

export async function getHealthCheckTasks(): Promise<SprintTask[]> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data, error } = await getSupabaseClient()
    .from('sprint_tasks')
    .select('*')
    .eq('status', 'active')
    .lt('started_at', oneHourAgo)

  if (error) {
    console.warn('[sprint-queries] getHealthCheckTasks failed:', error)
    return []
  }
  return (data ?? []) as SprintTask[]
}
