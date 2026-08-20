import { isSupabaseConfigured, supabase } from './supabase'

export type HealthStatus = 'Operational' | 'Degraded' | 'Not configured' | 'Unavailable'

export interface HealthItem {
  name: string
  status: HealthStatus
}

type Probe = 'ok' | 'missing' | 'error' | 'unconfigured'

function fromProbe(result: Probe): HealthStatus {
  if (result === 'unconfigured' || result === 'missing') return 'Not configured'
  if (result === 'ok') return 'Operational'
  return 'Unavailable'
}

/** HEAD count only — no rows returned, no writes. */
async function probeTable(table: string): Promise<Probe> {
  if (!isSupabaseConfigured) return 'unconfigured'
  const { error } = await supabase.from(table).select('id', { count: 'exact', head: true })
  if (!error) return 'ok'
  const code = error.code || ''
  const msg = (error.message || '').toLowerCase()
  if (
    code === '42501' ||
    code === 'PGRST301' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security')
  ) {
    return 'ok'
  }
  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  ) {
    return 'missing'
  }
  return 'error'
}

async function probeAuth(): Promise<HealthStatus> {
  if (!isSupabaseConfigured) return 'Not configured'
  try {
    const { error } = await supabase.auth.getSession()
    return error ? 'Unavailable' : 'Operational'
  } catch {
    return 'Unavailable'
  }
}

export async function loadDashboardHealth(): Promise<HealthItem[]> {
  const [profiles, bookings, payments, auth] = await Promise.all([
    probeTable('profiles'),
    probeTable('bookings'),
    probeTable('payments'),
    probeAuth(),
  ])

  const apiDb = fromProbe(profiles)

  return [
    { name: 'API', status: apiDb },
    { name: 'Database', status: apiDb },
    { name: 'Authentication', status: auth },
    { name: 'Payments', status: fromProbe(payments) },
    { name: 'Bookings', status: fromProbe(bookings) },
    { name: 'AI Services', status: 'Not configured' },
  ]
}

export async function loadAnalyticsHealth(): Promise<HealthItem[]> {
  const [profiles, courses, projects, bookings, live, payments, reports, auth] = await Promise.all([
    probeTable('profiles'),
    probeTable('courses'),
    probeTable('student_projects'),
    probeTable('bookings'),
    probeTable('live_classes'),
    probeTable('payments'),
    probeTable('reports'),
    probeAuth(),
  ])

  return [
    { name: 'Database', status: fromProbe(profiles) },
    { name: 'Authentication', status: auth },
    { name: 'Courses API', status: fromProbe(courses) },
    { name: 'Projects API', status: fromProbe(projects) },
    { name: 'Bookings', status: fromProbe(bookings) },
    { name: 'Live Classes', status: fromProbe(live) },
    { name: 'Payments', status: fromProbe(payments) },
    { name: 'Reports', status: fromProbe(reports) },
  ]
}
