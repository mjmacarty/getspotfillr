// components/cancellation-form.tsx
'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

interface Member {
  id: string
  name: string
  email: string
}

type BroadcastState = {
  status: 'idle' | 'success' | 'error'
  count?: number
  message?: string
}


interface CancellationFormProps {
  members: Member[] | null
  postCancellationAction: (prevState: BroadcastState, formData: FormData) => Promise<BroadcastState>
  defaultLessonDurationMinutes?: number
}

const TIME_OPTIONS = [
  '07:00', '07:15', '07:30', '07:45',
  '08:00', '08:15', '08:30', '08:45',
  '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30', '11:45',
  '12:00', '12:15', '12:30', '12:45',
  '13:00', '13:15', '13:30', '13:45',
  '14:00', '14:15', '14:30', '14:45',
  '15:00', '15:15', '15:30', '15:45',
  '16:00', '16:15', '16:30', '16:45',
  '17:00', '17:15', '17:30', '17:45',
  '18:00', '18:15', '18:30', '18:45',
  '19:00', '19:15', '19:30', '19:45',
  '20:00', '20:15', '20:30', '20:45',
  '21:00', '21:15', '21:30'
]

// Today's date in the browser's local time zone (avoids the UTC/local
// mismatch you get from `new Date().toISOString()` near midnight).
function getLocalToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Nearest half hour in the future, clamped to the dropdown's 07:00–21:30 range.
function getDefaultStartTime(): string {
  const now = new Date()
  let hours = now.getHours()
  const mins = now.getMinutes()
  const roundedMinutes = mins === 0 ? 0 : mins <= 30 ? 30 : 0
  if (mins > 30) hours += 1

  const candidate = `${String(hours).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`
  if (candidate < TIME_OPTIONS[0]) return TIME_OPTIONS[0]
  if (candidate > TIME_OPTIONS[TIME_OPTIONS.length - 1]) return TIME_OPTIONS[TIME_OPTIONS.length - 1]
  return candidate
}

function getEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes + durationMinutes, 0)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const initialState: BroadcastState = { status: 'idle' }

export default function CancellationForm({
  members,
  postCancellationAction,
  defaultLessonDurationMinutes = 25,
}: CancellationFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const [today, setToday] = useState(getLocalToday)
  const [startTime, setStartTime] = useState(getDefaultStartTime)
  const [endTime, setEndTime] = useState(() => getEndTime(getDefaultStartTime(), defaultLessonDurationMinutes))
  const [state, formAction, isPending] = useActionState(postCancellationAction, initialState)

  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime)
    if (!newStartTime || !newStartTime.includes(':')) return
    setEndTime(getEndTime(newStartTime, defaultLessonDurationMinutes))
  }

  // After a successful broadcast, reset the form and roll the date/time
  // defaults forward again rather than leaving stale values behind.
  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset()
      const freshToday = getLocalToday()
      const freshStart = getDefaultStartTime()
      setToday(freshToday)
      setStartTime(freshStart)
      setEndTime(getEndTime(freshStart, defaultLessonDurationMinutes))
    }
  }, [state, defaultLessonDurationMinutes])

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {/* Member Selection */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
          Fencer Who Canceled
        </label>
        <div className="relative">
          <select
            name="canceling_member_id"
            required
            className="w-full appearance-none cursor-pointer bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Select Member...</option>
            {members?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.email})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Date Picker - Opens picker anywhere you click */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
          Lesson Date
        </label>
        <input
          ref={dateInputRef}
          name="lesson_date"
          type="date"
          defaultValue={today}
          key={today}
          onClick={() => {
            try {
              dateInputRef.current?.showPicker()
            } catch (e) {
              // Fallback for older browsers
            }
          }}
          required
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer [color-scheme:dark]"
        />
      </div>

      {/* Start Time Selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
          Start Time
        </label>
        <div className="relative">
          <select
            name="start_time"
            value={startTime}
            onChange={(e) => handleStartTimeChange(e.target.value)}
            required
            className="w-full appearance-none cursor-pointer bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {TIME_OPTIONS.map((time) => (
              <option key={`start-${time}`} value={time}>
                {time}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* End Time Selector */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase">
            End Time
          </label>
          <span className="text-[10px] text-blue-400 font-medium">
            +{defaultLessonDurationMinutes}m auto
          </span>
        </div>
        <div className="relative">
          <select
            name="end_time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className="w-full appearance-none cursor-pointer bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {TIME_OPTIONS.map((time) => (
              <option key={`end-${time}`} value={time}>
                {time}
              </option>
            ))}
            {!TIME_OPTIONS.includes(endTime) && (
              <option value={endTime}>{endTime}</option>
            )}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-end gap-4 pt-2">
        {state.status === 'success' && (
          <p className="text-xs text-emerald-400 font-medium">
            {state.count && state.count > 0
              ? `✓ Broadcast sent to ${state.count} member${state.count === 1 ? '' : 's'}`
              : state.message}
          </p>
        )}
        {state.status === 'error' && (
          <p className="text-xs text-rose-400 font-medium">{state.message}</p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 font-semibold text-sm text-white px-6 py-2.5 rounded-lg transition"
        >
          {isPending ? 'Notifying...' : 'Notify Members Now'}
        </button>
      </div>
    </form>
  )
}