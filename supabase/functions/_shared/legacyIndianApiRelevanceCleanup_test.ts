import { assertEquals, assertRejects } from 'jsr:@std/assert@1'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  isLegacyIndianApiCleanupSource,
  runLegacyIndianApiRelevanceCleanup,
  shouldDeactivateStoredIndianApiJob,
  type StoredIndianApiJobRow,
} from './legacyIndianApiRelevanceCleanup.ts'

const irrelevantHr: StoredIndianApiJobRow = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Motorola solutions hiring fresher for hr apprentice trainee | bangalore',
  company: 'Motorola',
  description: 'Graduate trainee program.',
  job_type: 'Full-time',
  skills: [],
  requirements: [],
}

const relevantSwe: StoredIndianApiJobRow = {
  id: '00000000-0000-4000-8000-000000000002',
  title: 'Kaleris hiring fresher for associate software engineer intern | chennai',
  company: 'Kaleris',
  description: 'Work on javascript and react services.',
  job_type: 'Internship',
  skills: ['javascript', 'react'],
  requirements: [],
}

const otherProviderIrrelevant: StoredIndianApiJobRow = {
  id: '00000000-0000-4000-8000-000000000003',
  title: 'HR Apprentice Trainee',
  company: 'Legacy Co',
  description: 'Human resources apprenticeship.',
  job_type: null,
  skills: [],
  requirements: [],
}

function createMockAdmin(options: {
  fetchRows: StoredIndianApiJobRow[]
  onUpdate?: (id: string) => void
  updateError?: { message: string }
}): SupabaseClient {
  const order = () => ({
    limit: () => Promise.resolve({ data: options.fetchRows, error: null }),
    gt: () => Promise.resolve({ data: [], error: null }),
  })

  return {
    from: (table: string) => {
      if (table !== 'jobs') throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order,
            }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: (_c1: string, id: string) => ({
            eq: () => ({
              eq: async () => {
                if (options.updateError) {
                  return { error: options.updateError }
                }
                if (payload.is_active === false) {
                  options.onUpdate?.(id)
                }
                return { error: null }
              },
            }),
          }),
        }),
      }
    },
  } as unknown as SupabaseClient
}

Deno.test('active irrelevant legacy IndianAPI job is marked for deactivation', () => {
  assertEquals(shouldDeactivateStoredIndianApiJob(irrelevantHr), true)
})

Deno.test('relevant IndianAPI job remains active', () => {
  assertEquals(shouldDeactivateStoredIndianApiJob(relevantSwe), false)
})

Deno.test('non-IndianAPI source is out of legacy cleanup scope', () => {
  assertEquals(isLegacyIndianApiCleanupSource('indianapi'), true)
  assertEquals(isLegacyIndianApiCleanupSource('mock'), false)
  assertEquals(shouldDeactivateStoredIndianApiJob(otherProviderIrrelevant), true)
})

Deno.test('already inactive jobs are not returned by cleanup fetch', async () => {
  const admin = createMockAdmin({ fetchRows: [] })
  const result = await runLegacyIndianApiRelevanceCleanup(admin)
  assertEquals(result.evaluated, 0)
  assertEquals(result.deactivated, 0)
})

Deno.test('cleanup deactivates irrelevant rows and leaves relevant rows', async () => {
  const updates: string[] = []
  const admin = createMockAdmin({
    fetchRows: [irrelevantHr, relevantSwe],
    onUpdate: id => updates.push(id),
  })
  const result = await runLegacyIndianApiRelevanceCleanup(admin)
  assertEquals(result.evaluated, 2)
  assertEquals(result.deactivated, 1)
  assertEquals(result.deactivateReasons['reject:title'], 1)
  assertEquals(updates, [irrelevantHr.id])
})

Deno.test('cleanup failure surfaces error instead of silent success', async () => {
  const admin = createMockAdmin({
    fetchRows: [irrelevantHr],
    updateError: { message: 'permission denied' },
  })
  await assertRejects(
    () => runLegacyIndianApiRelevanceCleanup(admin),
    Error,
    'legacy relevance cleanup: deactivate failed: permission denied',
  )
})
