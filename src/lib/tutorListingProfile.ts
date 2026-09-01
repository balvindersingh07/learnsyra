import type { DayAvailability, TutorHub } from './tutorProfile'
import { ADVANCE_OPTIONS, BUFFER_OPTIONS, NOTICE_OPTIONS, WEEKDAYS, daySlotRanges, generateTimeSlots, toDisplayTime } from './tutorProfile'
import { isSupabaseConfigured, supabase } from './supabase'

export const AVAILABILITY_TAG_PREFIX = '__ls_avail:'

interface StoredAvailabilityV1 {
  v: 1
  days: Array<{ d: string; e: boolean; s: string; en: string }>
  tz?: string
  buf?: number
  notice?: number
  advance?: number
  blocked?: Array<{ f: string; t: string }>
  vacation?: boolean
}

export interface ListingAvailabilityMeta {
  availability: DayAvailability[]
  timezone: string
  bufferMinutes: number
  minNoticeHours: number
  maxAdvanceDays: number
  blockedDates: TutorHub['blockedDates']
  vacationMode: boolean
}

function normalizeBufferMinutes(value: number | undefined): TutorHub['bufferMinutes'] {
  return (BUFFER_OPTIONS as readonly number[]).includes(value ?? 10) ? (value as TutorHub['bufferMinutes']) : 10
}

function normalizeNoticeHours(value: number | undefined): TutorHub['minNoticeHours'] {
  return (NOTICE_OPTIONS as readonly number[]).includes(value ?? 6) ? (value as TutorHub['minNoticeHours']) : 6
}

function normalizeAdvanceDays(value: number | undefined): TutorHub['maxAdvanceDays'] {
  return (ADVANCE_OPTIONS as readonly number[]).includes(value ?? 14) ? (value as TutorHub['maxAdvanceDays']) : 14
}

function encodeAvailabilityTag(hub: TutorHub): string {
  const payload: StoredAvailabilityV1 = {
    v: 1,
    days: hub.availability.map(d => ({
      d: d.day,
      e: d.enabled,
      s: d.start,
      en: d.end,
    })),
    tz: hub.timezone,
    buf: hub.bufferMinutes,
    notice: hub.minNoticeHours,
    advance: hub.maxAdvanceDays,
    blocked: (hub.blockedDates ?? []).map(b => ({ f: b.from, t: b.to })),
    vacation: hub.vacationMode,
  }
  return `${AVAILABILITY_TAG_PREFIX}${btoa(JSON.stringify(payload))}`
}

export function isAvailabilityTag(tag: string) {
  return tag.startsWith(AVAILABILITY_TAG_PREFIX)
}

export function skillTagsFromListing(tags: string[]) {
  return tags.filter(t => !isAvailabilityTag(t))
}

export function decodeAvailabilityFromTags(tags: string[]): ListingAvailabilityMeta | null {
  const tag = tags.find(isAvailabilityTag)
  if (!tag) return null
  try {
    const raw = atob(tag.slice(AVAILABILITY_TAG_PREFIX.length))
    const parsed = JSON.parse(raw) as StoredAvailabilityV1
    if (parsed.v !== 1 || !Array.isArray(parsed.days)) return null
    const byDay = new Map(parsed.days.map(d => [d.d, d]))
    const availability = WEEKDAYS.map(day => {
      const row = byDay.get(day)
      return {
        day,
        enabled: Boolean(row?.e),
        start: row?.s || '09:00',
        end: row?.en || '18:00',
      }
    })
    return {
      availability,
      timezone: parsed.tz || 'Asia/Kolkata',
      bufferMinutes: parsed.buf ?? 15,
      minNoticeHours: parsed.notice ?? 6,
      maxAdvanceDays: parsed.advance ?? 14,
      blockedDates: (parsed.blocked ?? []).map((b, i) => ({
        id: `blk-${i}`,
        from: b.f,
        to: b.t,
        reason: '',
      })),
      vacationMode: Boolean(parsed.vacation),
    }
  } catch {
    return null
  }
}

async function findListingId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('tutor_listings')
    .select('id')
    .eq('profile_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as { id: string } | null)?.id ?? null
}

function publicAvatarUrl(hub: TutorHub): string | null {
  const url = hub.identity.avatarUrl?.trim()
  if (!url || url.startsWith('data:')) return null
  return url
}

/** Sync avatar URL + weekly availability onto the tutor listing (no pricing changes). */
export async function syncTutorListingProfile(hub: TutorHub): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: null }
  const listingId = await findListingId(hub.userId)
  if (!listingId) return { error: null }

  const skillTags = hub.skills.map(s => s.name.trim()).filter(Boolean)
  const tags = [...skillTags, encodeAvailabilityTag(hub)]
  const { error } = await supabase
    .from('tutor_listings')
    .update({
      tags,
      image_key: publicAvatarUrl(hub),
    })
    .eq('id', listingId)

  return { error: error?.message ?? null }
}

/** Merge server listing profile fields into a local hub (availability + avatar). */
export async function mergeListingProfileIntoHub(hub: TutorHub): Promise<TutorHub> {
  if (!isSupabaseConfigured) return hub
  const { data, error } = await supabase
    .from('tutor_listings')
    .select('tags, image_key')
    .eq('profile_id', hub.userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error || !data) return hub

  const row = data as { tags?: string[] | null; image_key?: string | null }
  const tags = row.tags ?? []
  const decoded = decodeAvailabilityFromTags(tags)
  const avatarUrl = row.image_key?.trim() || hub.identity.avatarUrl

  return {
    ...hub,
    identity: {
      ...hub.identity,
      avatarUrl: avatarUrl || hub.identity.avatarUrl,
    },
    ...(decoded
      ? {
          availability: decoded.availability,
          timezone: decoded.timezone,
          bufferMinutes: normalizeBufferMinutes(decoded.bufferMinutes),
          minNoticeHours: normalizeNoticeHours(decoded.minNoticeHours),
          maxAdvanceDays: normalizeAdvanceDays(decoded.maxAdvanceDays),
          blockedDates: decoded.blockedDates,
          vacationMode: decoded.vacationMode,
        }
      : {}),
  }
}

export function weeklyHoursFromAvailability(days: DayAvailability[]) {
  return days.map(d => ({
    day: d.day,
    hours: d.enabled
      ? daySlotRanges(d)
          .map(r => `${toDisplayTime(r.start)} — ${toDisplayTime(r.end)}`)
          .join(' · ')
      : 'Unavailable',
  }))
}

function weekdayFromDate(date: Date): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[(date.getDay() + 6) % 7]
}

function isToday(date: Date) {
  const n = new Date()
  return date.getFullYear() === n.getFullYear() && date.getMonth() === n.getMonth() && date.getDate() === n.getDate()
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isDateBlocked(meta: ListingAvailabilityMeta, date: Date) {
  const key = isoDay(date)
  return meta.blockedDates.some(b => b.from && b.to && key >= b.from && key <= b.to)
}

function parseDisplayTime(label: string) {
  const m = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  const ap = m[3].toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return { h, m: min }
}

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function isListingDateAvailable(meta: ListingAvailabilityMeta, date: Date) {
  if (meta.vacationMode) return false
  if (isDateBlocked(meta, date)) return false
  const row = meta.availability.find(d => d.day === weekdayFromDate(date))
  if (!row?.enabled) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const diffDays = Math.round((start.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return false
  if (diffDays > meta.maxAdvanceDays) return false
  const ranges = daySlotRanges(row)
  if (diffDays === 0) {
    const now = new Date()
    const latestEnd = Math.max(...ranges.map(r => toMinutes(r.end)))
    const end = new Date()
    end.setHours(Math.floor(latestEnd / 60), latestEnd % 60, 0, 0)
    const latest = new Date(now.getTime() + meta.minNoticeHours * 3600000)
    if (latest >= end) return false
  }
  return ranges.some(r => generateTimeSlots(r.start, r.end).length > 0)
}

export function listingSlotsForDate(meta: ListingAvailabilityMeta, date: Date) {
  if (meta.vacationMode || isDateBlocked(meta, date)) return []
  const row = meta.availability.find(d => d.day === weekdayFromDate(date))
  const slots = row?.enabled ? daySlotRanges(row).flatMap(r => generateTimeSlots(r.start, r.end)) : []
  const unique = [...new Set(slots)]
  const now = new Date()
  return unique.map(time => {
    let open = true
    if (isToday(date)) {
      const parsed = parseDisplayTime(time)
      if (parsed) {
        const when = new Date()
        when.setHours(parsed.h, parsed.m, 0, 0)
        if (when.getTime() < now.getTime() + meta.minNoticeHours * 3600000 + meta.bufferMinutes * 60000) open = false
      }
    }
    return { time, open }
  })
}
