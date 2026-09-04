// lib/verify.ts
// Server-only wrapper around Twilio Verify. Never import this into a client
// component -- TWILIO_AUTH_TOKEN is a real secret and must not reach the
// browser.
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID

function getClient() {
  if (!accountSid || !authToken || !verifyServiceSid) {
    throw new Error('Twilio Verify is not configured')
  }
  return twilio(accountSid, authToken)
}

/**
 * Normalizes a user-typed phone number to E.164, which is what Twilio
 * requires. Assumes US/Canada when no country code is given, since that's
 * the only region SpotFillr sends to today.
 * Returns null if the input can't plausibly be a phone number.
 */
export function toE164(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()

  // Already has a country code
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '')
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

/** Masks a phone for display: +16175551234 -> (***) ***-1234 */
export function maskPhone(e164: string): string {
  const last4 = e164.slice(-4)
  return `(***) ***-${last4}`
}

export async function sendVerificationCode(
  phoneE164: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = getClient()
    await client.verify.v2
      .services(verifyServiceSid!)
      .verifications.create({ to: phoneE164, channel: 'sms' })
    return { ok: true }
  } catch (err) {
    console.error('Twilio Verify send failed:', err)
    const message = err instanceof Error ? err.message : String(err)
    // Twilio returns 60200 for an invalid phone number, 60203 for too many
    // send attempts to the same number.
    if (message.includes('60200')) {
      return { ok: false, error: "That doesn't look like a valid mobile number." }
    }
    if (message.includes('60203')) {
      return { ok: false, error: 'Too many attempts for that number. Please wait a few minutes.' }
    }
    return { ok: false, error: "We couldn't send a code right now. Please try again." }
  }
}

export async function checkVerificationCode(
  phoneE164: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = getClient()
    const check = await client.verify.v2
      .services(verifyServiceSid!)
      .verificationChecks.create({ to: phoneE164, code })

    if (check.status === 'approved') return { ok: true }
    return { ok: false, error: 'That code was incorrect. Please try again.' }
  } catch (err) {
    console.error('Twilio Verify check failed:', err)
    const message = err instanceof Error ? err.message : String(err)
    // 20404 means the verification expired or was already used.
    if (message.includes('20404')) {
      return { ok: false, error: 'That code has expired. Request a new one.' }
    }
    return { ok: false, error: "We couldn't check that code. Please try again." }
  }
}
