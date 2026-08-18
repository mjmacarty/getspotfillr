// lib/notifications.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface BroadcastPayload {
  recipient: {
    id: string       // Member ID for personalized claim URL
    email: string
    phone?: string
  }
  slotId: string
  lessonDate: string
  startTime: string
  endTime: string
}

export async function sendBroadcastNotification({
  recipient,
  slotId,
  lessonDate,
  startTime,
  endTime,
}: BroadcastPayload) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const claimUrl = `${baseUrl}/claim/${slotId}?memberId=${recipient.id}`

  // 1. Send Real Email via Resend
  if (recipient.email) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'SpotFillr <alerts@getspotfillr.com>',
        to: recipient.email,
        subject: `Open Lesson Spot Available: ${lessonDate}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #0f172a; color: #ffffff; border-radius: 8px;">
            <h2 style="color: #60a5fa; margin-top: 0;">Open Lesson Slot Alert</h2>
            <p>A lesson slot has opened up at the club!</p>
            <div style="background-color: #1e293b; padding: 16px; border-radius: 6px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Date:</strong> ${lessonDate}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${startTime} - ${endTime}</p>
            </div>
            <p style="color: #94a3b8; font-size: 14px;">This spot is offered on a first-come, first-served basis.</p>
            <a href="${claimUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 12px;">
              Claim Slot Now
            </a>
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

  // 2. Mock SMS Output in Terminal
  if (recipient.phone) {
    console.log('\n================ [MOCK SMS SENT] ================')
    console.log(`TO: ${recipient.phone}`)
    console.log(`BODY: Open Lesson Alert! Spot on ${lessonDate} (${startTime} - ${endTime}). Claim: ${claimUrl}`)
    console.log('==================================================\n')
  }

  return { success: true }
}