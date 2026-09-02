// app/api/dashboard/slots/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data: coach } = await supabase
    .from('coaches')
    .select('club_id')
    .eq('id', user.id)
    .single()

  const { data: allSlots, error } = await supabase
    .from('canceled_lessons')
    .select(`
      *,
      canceling_member:members!canceling_member_id(name),
      claimed_member:members!claimed_by_member_id(name),
      coaches!inner(club_id)
    `)
    .eq('coaches.club_id', coach?.club_id)
    .order('lesson_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ slots: allSlots ?? [] })
}
