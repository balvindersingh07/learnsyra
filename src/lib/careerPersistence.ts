import { getCareerProfile, saveCareerProfile, type CareerProfile } from './api'
import { loadWeeklyActions, saveWeeklyActions, type CareerSnapshot } from './careerCenter'
import type { JobApplication } from './jobRecommendations'
import { loadApps, saveApps } from './jobRecommendations'
import type { InterviewCareerOverlay, InterviewRecord } from './interviewStudio'
import {
  loadHistory,
  loadInterviewCareerOverlay,
  loadUsedQuestionIds,
  saveHistory,
  saveInterviewCareerOverlay,
} from './interviewStudio'
import {
  loadActiveId,
  loadDocs,
  loadResumeCareerOverlay,
  saveActiveId,
  saveDocs,
  saveResumeCareerOverlay,
  type ResumeCareerOverlay,
  type ResumeDoc,
} from './resumeBuilder'
import { isSupabaseConfigured, peekAuthUserId } from './supabase'

export const CAREER_BLOB_VERSION = 1
const MIGRATED_KEY = 'learnsyra_career_server_migrated'

export interface CareerDataBlob {
  v: typeof CAREER_BLOB_VERSION
  summary?: string
  resume?: {
    docs: ResumeDoc[]
    activeId: string | null
  }
  resumeOverlay?: ResumeCareerOverlay | null
  interviews?: {
    history: InterviewRecord[]
    overlay: InterviewCareerOverlay | null
    usedQuestionIds: string[]
  }
  jobApps?: Record<string, JobApplication>
  weeklyActions?: CareerSnapshot['weeklyActions']
}

type StoredBlob = CareerDataBlob & { lsCareer?: number }

let cachedBlob: CareerDataBlob | null = null
let cachedUserId: string | null = null
let pendingPatch: Partial<CareerDataBlob> = {}
let saveTimer: number | null = null

function migrationKey(userId: string) {
  return `${MIGRATED_KEY}:${userId}`
}

export function parseCareerBlob(raw: string | null | undefined): CareerDataBlob | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as StoredBlob
    if (parsed && parsed.lsCareer === CAREER_BLOB_VERSION && parsed.v === CAREER_BLOB_VERSION) {
      const { lsCareer: _m, ...blob } = parsed
      return blob as CareerDataBlob
    }
  } catch {
    /* legacy plain summary */
  }
  return { v: CAREER_BLOB_VERSION, summary: raw.trim() }
}

export function serializeCareerBlob(blob: CareerDataBlob): string {
  return JSON.stringify({ lsCareer: CAREER_BLOB_VERSION, ...blob })
}

export function careerSummaryText(blob: CareerDataBlob | null, legacyResumeText?: string | null) {
  if (blob?.summary?.trim()) return blob.summary.trim()
  const activeId = blob?.resume?.activeId
  const doc =
    blob?.resume?.docs.find(d => d.id === activeId) ??
    blob?.resume?.docs.find(d => d.isDefault) ??
    blob?.resume?.docs[0]
  if (doc?.summary?.trim()) return doc.summary.trim()
  if (legacyResumeText && !legacyResumeText.trim().startsWith('{')) return legacyResumeText.trim()
  return ''
}

export function getCachedCareerData(userId?: string | null): CareerDataBlob | null {
  const uid = userId ?? peekAuthUserId()
  if (uid && cachedUserId && uid !== cachedUserId) return null
  return cachedBlob
}

function blobHasServerPayload(blob: CareerDataBlob | null) {
  if (!blob) return false
  return Boolean(
    blob.resume?.docs?.length ||
      blob.interviews?.history?.length ||
      (blob.jobApps && Object.keys(blob.jobApps).length) ||
      blob.resumeOverlay ||
      blob.interviews?.overlay,
  )
}

function buildBlobFromLocal(userId?: string | null): CareerDataBlob {
  const docs = loadDocs()
  const history = loadHistory()
  const apps = loadApps()
  const weekly = loadWeeklyActions([], userId)
  const activeId = loadActiveId()
  const activeDoc = docs.find(d => d.id === activeId) ?? docs[0]
  return {
    v: CAREER_BLOB_VERSION,
    summary: activeDoc?.summary?.trim() || undefined,
    resume: docs.length ? { docs, activeId: activeId ?? docs[0]?.id ?? null } : undefined,
    resumeOverlay: loadResumeCareerOverlay(userId) ?? undefined,
    interviews: history.length || loadInterviewCareerOverlay(userId)
      ? {
          history,
          overlay: loadInterviewCareerOverlay(userId),
          usedQuestionIds: loadUsedQuestionIds(),
        }
      : undefined,
    jobApps: Object.keys(apps).length ? apps : undefined,
    weeklyActions: weekly.some(w => w.done) ? weekly : undefined,
  }
}

function applyBlobToLocal(blob: CareerDataBlob, userId?: string | null) {
  if (blob.resume?.docs?.length) {
    saveDocs(blob.resume.docs)
    if (blob.resume.activeId) saveActiveId(blob.resume.activeId)
  }
  if (blob.resumeOverlay) saveResumeCareerOverlay(blob.resumeOverlay, userId)
  if (blob.interviews?.history) saveHistory(blob.interviews.history)
  if (blob.interviews?.overlay) saveInterviewCareerOverlay(blob.interviews.overlay, userId)
  if (blob.jobApps) saveApps(blob.jobApps)
  if (blob.weeklyActions?.length) saveWeeklyActions(blob.weeklyActions, userId)
}

function mergeProfileFields(blob: CareerDataBlob, profile: CareerProfile | null): CareerDataBlob {
  if (!profile) return blob
  const next = { ...blob }
  if (profile.target_role && next.resume?.docs?.length) {
    next.resume = {
      ...next.resume,
      docs: next.resume.docs.map((d, i) =>
        i === 0 || d.isDefault ? { ...d, targetRole: profile.target_role || d.targetRole } : d,
      ),
    }
  }
  if (!next.summary && profile.resume_text && !profile.resume_text.trim().startsWith('{')) {
    next.summary = profile.resume_text.trim()
  }
  return next
}

async function saveBlobToServer(
  userId: string,
  blob: CareerDataBlob,
  profile: CareerProfile | null,
  readinessScore?: number,
) {
  void userId
  const activeId = blob.resume?.activeId
  const activeDoc =
    blob.resume?.docs.find(d => d.id === activeId) ??
    blob.resume?.docs.find(d => d.isDefault) ??
    blob.resume?.docs[0]
  const summary = careerSummaryText(blob, profile?.resume_text)
  const { error } = await saveCareerProfile({
    target_role: activeDoc?.targetRole || profile?.target_role || undefined,
    resume_text: serializeCareerBlob({ ...blob, summary: summary || blob.summary }),
    skills: activeDoc?.skills.filter(s => s.included).map(s => s.name) ?? profile?.skills,
    readiness_score: readinessScore ?? profile?.readiness_score,
  })
  return { error }
}

export async function hydrateCareerData(userId: string | null): Promise<CareerDataBlob | null> {
  cachedUserId = userId
  if (!userId || !isSupabaseConfigured) {
    cachedBlob = buildBlobFromLocal(userId)
    return cachedBlob
  }

  const profile = await getCareerProfile().catch(() => null)
  let blob = parseCareerBlob(profile?.resume_text) ?? { v: CAREER_BLOB_VERSION }
  blob = mergeProfileFields(blob, profile)

  const localBlob = buildBlobFromLocal(userId)
  const migrated = localStorage.getItem(migrationKey(userId)) === '1'

  if (!migrated && !blobHasServerPayload(blob) && blobHasServerPayload(localBlob)) {
    blob = { ...localBlob, summary: localBlob.summary ?? blob.summary }
    const { error } = await saveBlobToServer(userId, blob, profile)
    if (!error) localStorage.setItem(migrationKey(userId), '1')
  } else if (!migrated && blobHasServerPayload(localBlob)) {
    blob = {
      ...blob,
      resume: blob.resume?.docs?.length ? blob.resume : localBlob.resume,
      resumeOverlay: blob.resumeOverlay ?? localBlob.resumeOverlay,
      interviews: blob.interviews?.history?.length ? blob.interviews : localBlob.interviews,
      jobApps: blob.jobApps && Object.keys(blob.jobApps).length ? blob.jobApps : localBlob.jobApps,
      weeklyActions: blob.weeklyActions ?? localBlob.weeklyActions,
      summary: blob.summary ?? localBlob.summary,
    }
    const { error } = await saveBlobToServer(userId, blob, profile)
    if (!error) localStorage.setItem(migrationKey(userId), '1')
  } else if (blobHasServerPayload(blob)) {
    applyBlobToLocal(blob, userId)
    if (!migrated) localStorage.setItem(migrationKey(userId), '1')
  }

  cachedBlob = blob
  return blob
}

function mergePatch(base: CareerDataBlob | null, patch: Partial<CareerDataBlob>): CareerDataBlob {
  const current = base ?? { v: CAREER_BLOB_VERSION }
  return {
    v: CAREER_BLOB_VERSION,
    summary: patch.summary ?? current.summary,
    resume: patch.resume ?? current.resume,
    resumeOverlay: patch.resumeOverlay !== undefined ? patch.resumeOverlay : current.resumeOverlay,
    interviews: patch.interviews ?? current.interviews,
    jobApps: patch.jobApps ?? current.jobApps,
    weeklyActions: patch.weeklyActions ?? current.weeklyActions,
  }
}

let pendingReadiness: number | undefined

export async function flushCareerPersist(userId?: string | null): Promise<{ error: string | null }> {
  const uid = userId ?? peekAuthUserId()
  if (!uid) return { error: null }
  if (!Object.keys(pendingPatch).length) return { error: null }

  const patch = pendingPatch
  const readiness = pendingReadiness
  pendingPatch = {}
  pendingReadiness = undefined
  cachedBlob = mergePatch(cachedBlob ?? buildBlobFromLocal(uid), patch)
  applyBlobToLocal(cachedBlob, uid)

  if (!isSupabaseConfigured) return { error: null }
  const profile = await getCareerProfile().catch(() => null)
  return saveBlobToServer(uid, cachedBlob, profile, readiness)
}

export function scheduleCareerPersist(userId: string | null, patch: Partial<CareerDataBlob>, readinessScore?: number) {
  pendingPatch = mergePatch(pendingPatch as CareerDataBlob, patch)
  if (readinessScore != null) pendingReadiness = readinessScore
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void flushCareerPersist(userId)
  }, 700)
}

export async function persistCareerNow(
  userId: string | null,
  patch: Partial<CareerDataBlob>,
  readinessScore?: number,
) {
  if (saveTimer) {
    window.clearTimeout(saveTimer)
    saveTimer = null
  }
  pendingPatch = mergePatch(pendingPatch as CareerDataBlob, patch)
  if (readinessScore != null) pendingReadiness = readinessScore
  return flushCareerPersist(userId)
}

export function syncResumeToCareerStore(userId: string | null, docs: ResumeDoc[], activeId: string | null, overlay?: ResumeCareerOverlay) {
  const activeDoc = docs.find(d => d.id === activeId) ?? docs[0]
  scheduleCareerPersist(userId, {
    summary: activeDoc?.summary,
    resume: docs.length ? { docs, activeId } : undefined,
    resumeOverlay: overlay ?? undefined,
  })
}

export function syncInterviewToCareerStore(
  userId: string | null,
  history: InterviewRecord[],
  overlay: InterviewCareerOverlay | null,
  usedQuestionIds?: string[],
) {
  scheduleCareerPersist(userId, {
    interviews: {
      history,
      overlay,
      usedQuestionIds: usedQuestionIds ?? loadUsedQuestionIds(),
    },
  })
}

export function syncJobAppsToCareerStore(userId: string | null, apps: Record<string, JobApplication>) {
  scheduleCareerPersist(userId, { jobApps: apps })
}

export function syncWeeklyActionsToCareerStore(userId: string | null, weeklyActions: CareerSnapshot['weeklyActions']) {
  scheduleCareerPersist(userId, { weeklyActions })
}
