// lib/sms.ts
// Server-only. Sends SMS through the registered A2P 10DLC campaign number.
// Distinct from lib/verify.ts, which uses Twilio Verify for one-time codes
// and does not go through campaign registration.
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER

export function isSmsConfigured(): boolean {
  return Boolean(accountSid && authToken && fromNumber)
}

/**
 * Best-effort SMS send. Never throws -- a failed text must not break the
 * surrounding flow (a member's opt-in still succeeds; a broadcast's emails
 * still go out). Until the A2P campaign is approved, Twilio will reject
 * these and the failure is logged here.
 */
export async function sendSms(
  to: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSmsConfigured()) {
    console.warn('[SMS] Not configured -- skipping send to', to)
    return { ok: false, error: 'SMS not configured' }
  }

  try {
    const client = twilio(accountSid!, authToken!)
    const message = await client.messages.create({
      to,
      from: fromNumber!,
      body,
    })
    console.log(`[SMS SENT] to=${to} sid=${message.sid} len=${body.length}`)
    return { ok: true }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error(`[SMS FAILED] to=${to}: ${detail}`)
    return { ok: false, error: detail }
  }
}

/**
 * Sent once, immediately after a member verifies their number and opts in.
 * Completes the double opt-in loop CTIA expects, and is what gets declared
 * as the campaign's opt-in message during A2P registration -- so this
 * wording should stay in sync with what's registered there.
 */
export async function sendOptInConfirmation(to: string) {
  return sendSms(
    to,
    "SpotFillr: You're subscribed to lesson opening alerts for your club. " +
      'Msg&data rates may apply. Msg frequency varies. ' +
      'Reply HELP for help, STOP to cancel.'
  )
}
