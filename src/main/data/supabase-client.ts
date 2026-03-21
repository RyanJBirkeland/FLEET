/**
 * Supabase client singleton for sprint task operations.
 * Reads connection config from BDE settings or environment variables.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSetting } from '../settings'

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const url = getSetting('supabase.url') ?? process.env.SUPABASE_URL
  const key = getSetting('supabase.serviceKey') ?? process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error('Supabase URL and service key must be configured in settings or environment')
  }

  client = createClient(url, key)
  return client
}

/** Reset client — used in tests. */
export function resetSupabaseClient(): void {
  client = null
}
