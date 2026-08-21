import { loadAdminStringMap, saveAdminStringMap } from './adminStorage'
import { loadAdminTutorIndex, type AdminTutorIndex, type AdminTutorRow } from './adminTutors'

const NOTES_KEY = 'learnsyra_admin_verification_notes'

export function isVerificationBackendAvailable() {
  return Boolean(import.meta.env.VITE_VERIFICATION_API)
}

export interface VerificationCenter {
  backend: boolean
  tutorCount: number
  index: AdminTutorIndex
}

export async function loadVerificationCenter(): Promise<VerificationCenter> {
  const index = await loadAdminTutorIndex()
  return {
    backend: isVerificationBackendAvailable(),
    tutorCount: index.tutors.filter(t => !t.demo).length,
    index,
  }
}

export function verificationStats(input: { backend: boolean; tutorCount: number }) {
  if (!input.backend) {
    return {
      totalTutors: String(input.tutorCount),
      pending: '—',
      needsChanges: '—',
      verified: 'Data unavailable',
      rejected: '—',
    }
  }
  return {
    totalTutors: String(input.tutorCount),
    pending: '0',
    needsChanges: '0',
    verified: '0',
    rejected: '0',
  }
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
