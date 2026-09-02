// lib/notifications.ts
import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

interface BroadcastPayload {
  supabase: SupabaseClient
  recipient: {
    id: string       // Member ID for personalized claim URL
    email: string
    phone?: string | null   // Only pass this when the member has opted into SMS
  }
  slotId: string
  lessonDate: string
  startTime: string
  endTime: string
  coachName?: string | null
  timezone?: string | null   // Coach's club timezone, for humanizing "today"/"tomorrow"
}

const SHORT_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789' // no 0/O/1/l/I

function generateShortCode(length = 8): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += SHORT_CODE_CHARS[Math.floor(Math.random() * SHORT_CODE_CHARS.length)]
  }
  return code
}

// Turns a 'YYYY-MM-DD' lesson date into "today", "tomorrow", or a short
// fallback like "Thu, Aug 20" -- relative to the coach's own club timezone.
function humanizeLessonDate(lessonDate: string, timezone: string): string {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: timezone })

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: timezone })

  if (lessonDate === todayStr) return 'today'
  if (lessonDate === tomorrowStr) return 'tomorrow'

  const [year, month, day] = lessonDate.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day, 12))
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export async function sendBroadcastNotification({
  supabase,
  recipient,
  slotId,
  lessonDate,
  startTime,
  endTime,
  coachName,
  timezone,
}: BroadcastPayload) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const claimUrl = `${baseUrl}/claim/${slotId}?memberId=${recipient.id}`
  const preferencesUrl = `${baseUrl}/preferences/${recipient.id}`

  const humanizedDate = humanizeLessonDate(lessonDate, timezone || 'America/New_York')
  const headline = coachName
    ? `Coach ${coachName} has a lesson opening ${humanizedDate}`
    : `A lesson slot has opened up ${humanizedDate}`

  // 1. Send Real Email via Resend
  if (recipient.email) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'SpotFillr <alerts@getspotfillr.com>',
        to: recipient.email,
        subject: `Open Lesson Spot Available: ${lessonDate}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #0f172a; color: #ffffff; border-radius: 8px;">
            <h2 style="color: #60a5fa; margin-top: 0;">${headline}!</h2>
            <div style="background-color: #1e293b; padding: 16px; border-radius: 6px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Date:</strong> ${lessonDate}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${startTime} - ${endTime}</p>
            </div>
            <p style="color: #94a3b8; font-size: 14px;">This spot is offered on a first-come, first-served basis.</p>
            <a href="${claimUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 12px;">
              Claim Slot Now
            </a>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e293b;">
              Want text alerts too? <a href="${preferencesUrl}" style="color: #60a5fa;">Manage your alert preferences</a>.
            </p>
          </div>
        `,
      })

      if (error) {
        console.error('Resend Error:', error)
      } else {
        console.log(`[REAL EMAIL SENT] To: ${recipient.email} | ID: ${data?.id}`)
      }
    } catch (err) {
      console.error(`Failed to send email to ${recipient.email}:`, err)
    }
  }

  // 2. SMS -- only sent when recipient.phone is present (caller is
  // responsible for omitting phone unless sms_opt_in is true).
  if (recipient.phone) {
    let smsUrl = claimUrl
    const code = generateShortCode()
    const { error: linkError } = await supabase
      .from('claim_links')
      .insert({ code, slot_id: slotId, member_id: recipient.id })

    if (!linkError) {
      smsUrl = `${baseUrl}/c/${code}`
    } else {
      console.error('Could not create short claim link, falling back to full URL:', linkError)
    }

    const smsBody = `${headline}. Claim: ${smsUrl}`

    // TODO: replace with a real Twilio send now that A2P registration is approved.
    console.log('\n================ [MOCK SMS SENT] ================')
    console.log(`TO: ${recipient.phone}`)
    console.log(`BODY: ${smsBody}`)
    console.log(`LENGTH: ${smsBody.length} chars (1 segment if <=160)`)
    console.log('==================================================\n')
  }

  return { success: true }
}
