// app/c/[code]/route.ts
// Resolves a short SMS claim code (e.g. /c/aB3xQ9pK) to the real claim page
// URL. Exists purely to keep SMS messages under the 160-char single-segment
// limit -- email links use the full /claim/[id]?memberId=... URL directly.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const { origin } = new URL(request.url)
  const supabase = await createClient()

  const { data: link } = await supabase
    .from('claim_links')
    .select('slot_id, member_id')
    .eq('code', code)
    .single()

  if (!link) {
    return NextResponse.redirect(`${origin}/login?error=That link is invalid or has expired`)
  }

  return NextResponse.redirect(
    `${origin}/claim/${link.slot_id}?memberId=${link.member_id}`
  )
}
