// lib/supabase/admin.ts
// Service-role client. This bypasses ALL row level security, so it must
// never be imported into a client component and the key must never carry a
// NEXT_PUBLIC_ prefix.
//
// Used only where a write must be impossible to trigger with the public
// publishable key -- currently just granting SMS consent, which is only
// legitimate after Twilio Verify has confirmed the phone number.
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase admin client is not configured')
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
