import { createBrowserClient } from '@supabase/ssr'

// Module-level singleton — created once when the module first loads.
// This is the same instance used by UserContext, so it's always authenticated.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Keep createClient() for backward compatibility with existing imports
export function createClient() {
  return supabase
}
