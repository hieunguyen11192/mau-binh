import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function isMultiplayerConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  return Boolean(
    url &&
      key &&
      !url.includes('YOUR_PROJECT') &&
      !key.includes('YOUR_KEY'),
  )
}

export function getSupabase(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
  if (!url || !key) {
    throw new Error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY')
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
