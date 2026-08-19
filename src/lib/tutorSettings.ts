import {
  daySlotRanges,
  hubSlotsForDate,
  invalidRange,
  isHubDateAvailable,
  profileStrength,
  publishBlockers,
  rangesOverlap,
  uid,
  type ExtraRange,
  type StudentLevel,
  type TutorHub,
} from './tutorProfile'
import { upcomingDates } from './tutorMarketplace'

export type SettingsSection =
  | 'overview'
  | 'profile'
  | 'expertise'
  | 'preferences'
  | 'availability'
  | 'pricing'
  | 'notifications'
  | 'security'
  | 'privacy'
  | 'verification'
  | 'visibility'
  | 'account'

export const SETTINGS_NAV: { group: string; items: { id: SettingsSection; label: string }[] }[] = [
  {
    group: 'Professional',
    items: [
      { id: 'profile', label: 'Profile' },
      { id: 'expertise', label: 'Expertise' },
      { id: 'preferences', label: 'Teaching Preferences' },
      { id: 'availability', label: 'Availability' },
      { id: 'pricing', label: 'Pricing' },
    ],
  },
  {
    group: 'Account',
    items: [
      { id: 'notifications', label: 'Notifications' },
      { id: 'security', label: 'Security' },
      { id: 'privacy', label: 'Privacy' },
    ],
  },
  {
    group: 'Verification',
    items: [{ id: 'verification', label: 'Verification Center' }],
  },
  {
    group: 'Marketplace',
    items: [{ id: 'visibility', label: 'Visibility' }],
  },
  {
    group: 'Account Actions',
    items: [{ id: 'account', label: 'Pause Tutor Account' }],
  },
]

export const SECTION_FROM_HASH: Record<string, SettingsSection> = {
  overview: 'overview',
  profile: 'profile',
  expertise: 'expertise',
  preferences: 'preferences',
  availability: 'availability',
  pricing: 'pricing',
  notifications: 'notifications',
  security: 'security',
  privacy: 'privacy',
  verification: 'verification',
  visibility: 'visibility',
  account: 'account',
}

export type NotifyChannel = { email: boolean; inApp: boolean }

export interface NotifyPrefs {
  students: NotifyChannel
  sessions: NotifyChannel
  courses: NotifyChannel
  projects: NotifyChannel
  earnings: NotifyChannel
  platform: NotifyChannel
}

const NOTIFY_KEY = (userId: string) => `learnsyra_tutor_notify_${userId}`

const DEFAULT_CHANNEL: NotifyChannel = { email: true, inApp: true }

export function defaultNotifyPrefs(): NotifyPrefs {
  return {
    students: { ...DEFAULT_CHANNEL },
    sessions: { ...DEFAULT_CHANNEL },
    courses: { ...DEFAULT_CHANNEL },
    projects: { ...DEFAULT_CHANNEL },
    earnings: { ...DEFAULT_CHANNEL },
    platform: { email: true, inApp: true },
  }
}

export function loadNotifyPrefs(userId: string): NotifyPrefs {
  try {
    const raw = localStorage.getItem(NOTIFY_KEY(userId))
    if (!raw) return defaultNotifyPrefs()
    return { ...defaultNotifyPrefs(), ...(JSON.parse(raw) as NotifyPrefs) }
  } catch {
    return defaultNotifyPrefs()
  }
}

export function saveNotifyPrefs(userId: string, prefs: NotifyPrefs) {
  localStorage.setItem(NOTIFY_KEY(userId), JSON.stringify(prefs))
}

export const NOTIFY_CATEGORIES: { id: keyof NotifyPrefs; title: string; items: string }[] = [
  { id: 'students', title: 'Students', items: 'New student, student question, project submission' },
  { id: 'sessions', title: 'Sessions', items: 'Booking, cancellation, reminder, session starting' },
  { id: 'courses', title: 'Courses', items: 'Course review, student enrollment, course feedback' },
  { id: 'projects', title: 'Projects', items: 'Submission, resubmission, review request' },
  { id: 'earnings', title: 'Earnings', items: 'Payment, payout, refund' },
  { id: 'platform', title: 'Platform', items: 'Announcements, policy updates' },
]

export function visibilityLabel(v: TutorHub['visibility']) {
  if (v === 'published') return 'Published'
  if (v === 'paused') return 'Paused'
  return 'Draft'
}

export function visibilityHelp(v: TutorHub['visibility']) {
  if (v === 'published') return 'Students can discover and book you.'
  if (v === 'paused') return 'Profile temporarily hidden from new discovery and bookings.'
  return 'Profile is not discoverable.'
}

export function availabilityStatus(hub: TutorHub) {
  if (hub.vacationMode) return 'Vacation — new bookings paused'
  if (hub.visibility === 'paused') return 'Paused'
  if (hub.availability.some(d => d.enabled)) return 'Available'
  return 'Not set'
}

export function pricingStatus(hub: TutorHub) {
  if (hub.sessionOffers.some(s => s.enabled && s.hourlyRate > 0)) return 'Configured'
  if (hub.sessionOffers.some(s => s.enabled)) return 'Add pricing before accepting paid bookings.'
  return 'Not configured'
}

export function verificationDisplay() {
  return {
    identity: 'unavailable' as const,
    documents: 'unavailable' as const,
    identityCopy: 'Identity verification will be available when verification infrastructure is connected.',
    documentsCopy: 'Professional credential verification will be available when document review is connected.',
    phoneCopy: 'Phone verification is not connected.',
    badgeCopy: 'Verification is separate from profile completeness. Tutors cannot self-assign a Verified badge.',
  }
}

export interface PublishCheck {
  id: string
  label: string
  done: boolean
  optional?: boolean
}

export function settingsChecklist(hub: TutorHub): PublishCheck[] {
  return [
    { id: 'name', label: 'Name', done: hub.identity.name.trim().length > 1 },
    { id: 'headline', label: 'Headline', done: hub.identity.headline.trim().length > 3 },
    { id: 'bio', label: 'Bio', done: hub.bio.trim().length >= 20 },
    { id: 'expertise', label: 'Expertise', done: hub.skills.length > 0 },
    { id: 'style', label: 'Teaching Style', done: hub.teachingStyles.length > 0 },
    { id: 'types', label: 'Session Types', done: hub.sessionOffers.some(s => s.enabled) },
    { id: 'pricing', label: 'Pricing', done: hub.sessionOffers.some(s => s.enabled && s.hourlyRate > 0) },
    { id: 'availability', label: 'Availability', done: hub.availability.some(d => d.enabled) },
    { id: 'photo', label: 'Profile Photo', done: Boolean(hub.identity.avatarUrl) },
    { id: 'video', label: 'Intro Video', done: Boolean(hub.introVideoUrl.trim()), optional: true },
    { id: 'portfolio', label: 'Portfolio', done: hub.portfolioProjectIds.length > 0, optional: true },
    { id: 'verification', label: 'Verification', done: false, optional: true },
  ]
}

export function setupSnapshot(hub: TutorHub) {
  const strength = profileStrength(hub)
  return {
    profile: `${strength.percent}% Complete`,
    verification: 'Not Submitted',
    marketplace: visibilityLabel(hub.visibility),
    availability: availabilityStatus(hub),
    pricing: pricingStatus(hub),
    percent: strength.percent,
    blockers: publishBlockers(hub),
  }
}

export function previewSlots(hub: TutorHub, limit = 6) {
  const out: { date: Date; time: string }[] = []
  for (const date of upcomingDates(14)) {
    if (hub.vacationMode) return []
    if (!isHubDateAvailable(hub, date)) continue
    for (const s of hubSlotsForDate(hub, date).filter(x => x.open)) {
      out.push({ date, time: s.time })
      if (out.length >= limit) return out
    }
  }
  return out
}

export function validateAvailability(hub: TutorHub): string | null {
  for (const day of hub.availability) {
    if (!day.enabled) continue
    const ranges = daySlotRanges(day)
    for (const r of ranges) {
      if (invalidRange(r)) return `${day.day}: end time must be after start time.`
    }
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        if (rangesOverlap(ranges[i], ranges[j])) return `${day.day}: time slots overlap.`
      }
    }
  }
  return null
}

export function validatePricing(hub: TutorHub): string | null {
  for (const offer of hub.sessionOffers) {
    if (offer.enabled && offer.hourlyRate < 0) return 'Pricing cannot be negative.'
    if (offer.enabled && !Number.isFinite(offer.hourlyRate)) return 'Enter a valid hourly rate.'
  }
  return null
}

export function validateBlocked(hub: TutorHub): string | null {
  for (const row of hub.blockedDates ?? []) {
    if (!row.from || !row.to) return 'Blocked dates need a start and end date.'
    if (row.to < row.from) return 'Blocked date range cannot end before it starts.'
  }
  return null
}

export function addExtraRange(): ExtraRange {
  return { id: uid('slot'), start: '14:00', end: '18:00' }
}

export function toggleLevel(list: StudentLevel[], level: StudentLevel) {
  return list.includes(level) ? list.filter(l => l !== level) : [...list, level]
}
