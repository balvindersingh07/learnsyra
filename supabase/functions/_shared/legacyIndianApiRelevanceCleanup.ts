import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  assessJobRelevance,
  type JobRelevanceRejectReason,
  type JobRelevanceInput,
} from './jobIngest.ts'

export const LEGACY_CLEANUP_SOURCE = 'indianapi'

const BATCH_SIZE = 100

export type StoredIndianApiJobRow = {
  id: string
  title: string
  company: string
  description: string | null
  job_type: string | null
  skills: string[] | null
  requirements: string[] | null
}

export type LegacyCleanupResult = {
  evaluated: number
  deactivated: number
  deactivateReasons: Record<JobRelevanceRejectReason, number>
}

function emptyDeactivateReasons(): Record<JobRelevanceRejectReason, number> {
  return {
    'reject:title': 0,
    'reject:domain': 0,
    'reject:no_it_signal': 0,
  }
}

export function isLegacyIndianApiCleanupSource(source: string): boolean {
  return source === LEGACY_CLEANUP_SOURCE
}

/** Map a stored `public.jobs` row to the same shape used at IndianAPI ingest time. */
export function storedIndianApiJobToRelevanceInput(row: StoredIndianApiJobRow): JobRelevanceInput {
  const skillsBlob = [...(row.skills ?? []), ...(row.requirements ?? [])].filter(Boolean).join(', ')
  return {
    title: row.title ?? '',
    job_title: null,
    job_description: row.description,
    role_and_responsibility: null,
    education_and_skills: skillsBlob || null,
    experience: null,
    job_type: row.job_type,
    company: row.company,
  }
}

export function shouldDeactivateStoredIndianApiJob(row: StoredIndianApiJobRow): boolean {
  return !assessJobRelevance(storedIndianApiJobToRelevanceInput(row)).accept
}

export async function runLegacyIndianApiRelevanceCleanup(admin: SupabaseClient): Promise<LegacyCleanupResult> {
  const deactivateReasons = emptyDeactivateReasons()
  let evaluated = 0
  let deactivated = 0
  let lastId: string | null = null
  const nowIso = new Date().toISOString()

  while (true) {
    let query = admin
      .from('jobs')
      .select('id, title, company, description, job_type, skills, requirements')
      .eq('source', LEGACY_CLEANUP_SOURCE)
      .eq('is_active', true)
      .order('id')
      .limit(BATCH_SIZE)

    if (lastId) {
      query = query.gt('id', lastId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`legacy relevance cleanup: fetch failed: ${error.message}`)
    }
    if (!data?.length) break

    for (const row of data as StoredIndianApiJobRow[]) {
      evaluated++
      const relevance = assessJobRelevance(storedIndianApiJobToRelevanceInput(row))
      if (relevance.accept) continue

      const reason = relevance.reason ?? 'reject:no_it_signal'
      const { error: updError } = await admin
        .from('jobs')
        .update({ is_active: false, updated_at: nowIso })
        .eq('id', row.id)
        .eq('source', LEGACY_CLEANUP_SOURCE)
        .eq('is_active', true)

      if (updError) {
        throw new Error(`legacy relevance cleanup: deactivate failed: ${updError.message}`)
      }

      deactivated++
      deactivateReasons[reason]++
    }

    lastId = data[data.length - 1]?.id ?? null
    if (data.length < BATCH_SIZE) break
  }

  return { evaluated, deactivated, deactivateReasons }
}
