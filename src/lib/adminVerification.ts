import type { TutorListing } from './api'
import {
  adminApproveTutor,
  adminRejectTutor,
  adminSuspendTutor,
  isModerationBackendAvailable,
} from './adminModeration'
import { loadAdminStringMap, saveAdminStringMap } from './adminStorage'
import { loadAdminTutorIndex, type AdminTutorIndex, type AdminTutorRow } from './adminTutors'

const NOTES_KEY = 'learnsyra_admin_verification_notes'

export type VerificationTab =
  | 'All'
  | 'Pending Review'
  | 'Needs Changes'
  | 'Approved'
  | 'Rejected'
  | 'Not Submitted'

export type TutorVerificationStatus = 'not_submitted' | 'pending' | 'needs_changes' | 'approved' | 'rejected'

export interface VerificationCenter {
  backend: boolean
  tutorCount: number
  index: AdminTutorIndex
}

function listingFor(tutorId: string, listings: TutorListing[]) {
  return listings.find(l => l.profile_id === tutorId) ?? null
}

export function isVerificationBackendAvailable() {
  return isModerationBackendAvailable()
}

export function tutorVerificationStatus(tutor: AdminTutorRow, listing: TutorListing | null): TutorVerificationStatus {
  if (tutor.demo) return 'not_submitted'
  if (!listing) {
    if (tutor.courseCount > 0 || tutor.hasHub || tutor.headline || tutor.listingId) return 'pending'
    return 'not_submitted'
  }
  if (listing.available) return 'approved'
  if (tutor.unpublishedCount > 0) return 'needs_changes'
  return 'rejected'
}

export function verificationStatusLabel(status: TutorVerificationStatus) {
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  if (status === 'needs_changes') return 'Needs Changes'
  if (status === 'pending') return 'Pending Review'
  return 'Not Submitted'
}

export async function loadVerificationCenter(): Promise<VerificationCenter> {
  const index = await loadAdminTutorIndex()
  return {
    backend: isVerificationBackendAvailable(),
    tutorCount: index.tutors.filter(t => !t.demo).length,
    index,
  }
}

export function verificationStats(index: AdminTutorIndex) {
  const real = index.tutors.filter(t => !t.demo)
  const statuses = real.map(t => tutorVerificationStatus(t, listingFor(t.id, index.listings)))
  return {
    totalTutors: String(real.length),
    pending: String(statuses.filter(s => s === 'pending').length),
    needsChanges: String(statuses.filter(s => s === 'needs_changes').length),
    verified: String(statuses.filter(s => s === 'approved').length),
    rejected: String(statuses.filter(s => s === 'rejected').length),
  }
}

export function filterVerificationTutors(
  index: AdminTutorIndex,
  tab: VerificationTab,
  q: string,
): AdminTutorRow[] {
  const query = q.trim().toLowerCase()
  let rows = index.tutors.filter(t => !t.demo)
  if (tab !== 'All') {
    rows = rows.filter(t => {
      const status = tutorVerificationStatus(t, listingFor(t.id, index.listings))
      if (tab === 'Pending Review') return status === 'pending'
      if (tab === 'Needs Changes') return status === 'needs_changes'
      if (tab === 'Approved') return status === 'approved'
      if (tab === 'Rejected') return status === 'rejected'
      if (tab === 'Not Submitted') return status === 'not_submitted'
      return true
    })
  }
  if (query) {
    rows = rows.filter(
      t =>
        t.name.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query) ||
        (t.headline && t.headline.toLowerCase().includes(query)) ||
        (t.email && t.email.toLowerCase().includes(query)),
    )
  }
  return rows.sort((a, b) => {
    const sa = tutorVerificationStatus(a, listingFor(a.id, index.listings))
    const sb = tutorVerificationStatus(b, listingFor(b.id, index.listings))
    const pendingRank = (s: TutorVerificationStatus) =>
      s === 'pending' || s === 'needs_changes' ? 0 : s === 'not_submitted' ? 1 : 2
    const rank = pendingRank(sa) - pendingRank(sb)
    if (rank) return rank
    return +(new Date(b.joinedAt || 0)) - +(new Date(a.joinedAt || 0))
  })
}

export function loadVerificationNotes(): Record<string, string> {
  return loadAdminStringMap(NOTES_KEY)
}

export function saveVerificationNote(tutorId: string, note: string) {
  const map = loadVerificationNotes()
  const next = note.trim()
  if (next) map[tutorId] = next
  else delete map[tutorId]
  saveAdminStringMap(NOTES_KEY, map)
}

export function findVerificationTutor(index: AdminTutorIndex, id: string): AdminTutorRow | null {
  return index.tutors.find(t => t.id === id) ?? null
}

export { adminApproveTutor, adminRejectTutor, adminSuspendTutor }
