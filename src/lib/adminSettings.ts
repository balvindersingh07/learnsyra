import {
  isFinancialExportAvailable,
  isPayoutInfrastructureAvailable,
  isRefundApiAvailable,
  loadAdminPaymentIndex,
} from './adminPayments'
import { isVerificationBackendAvailable } from './adminVerification'
import { isSupabaseConfigured } from './supabase'

export type SettingsCategory =
  | 'general'
  | 'branding'
  | 'learning'
  | 'marketplace'
  | 'sessions'
  | 'notifications'
  | 'ai'
  | 'security'
  | 'privacy'
  | 'payments'
  | 'verification'
  | 'integrations'
  | 'features'
  | 'maintenance'

export type SettingBadge = 'connected' | 'configured' | 'not-connected' | 'unavailable' | 'managed' | 'read-only'

export interface SettingRow {
  key: string
  label: string
  value: string
  description?: string
  badge: SettingBadge
  source: 'Backend' | 'Environment' | 'Application' | 'Unavailable'
}

export interface SettingLink {
  label: string
  href: string
}

export interface SettingsPanel {
  id: SettingsCategory
  title: string
  intro: string
  rows: SettingRow[]
  note: string
  links: SettingLink[]
  failed?: boolean
}

export interface AdminSettingsPack {
  panels: SettingsPanel[]
  writable: boolean
  auditAvailable: boolean
}

export const SETTINGS_NAV: { id: SettingsCategory; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'branding', label: 'Branding' },
  { id: 'learning', label: 'Learning' },
  { id: 'marketplace', label: 'Tutor Marketplace' },
  { id: 'sessions', label: 'Sessions & Booking' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'ai', label: 'AI & Learning' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'payments', label: 'Payments' },
  { id: 'verification', label: 'Verification' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'features', label: 'Features' },
  { id: 'maintenance', label: 'Maintenance' },
]

export function parseSettingsCategory(raw: string | null): SettingsCategory {
  return SETTINGS_NAV.some(n => n.id === raw) ? (raw as SettingsCategory) : 'general'
}

export function badgeLabel(badge: SettingBadge) {
  if (badge === 'connected') return 'Connected'
  if (badge === 'configured') return 'Configured'
  if (badge === 'not-connected') return 'Not connected'
  if (badge === 'unavailable') return 'Unavailable'
  if (badge === 'managed') return 'Managed by application'
  return 'Read only'
}

function row(partial: SettingRow): SettingRow {
  return partial
}

function panel(partial: SettingsPanel): SettingsPanel {
  return partial
}

export async function loadAdminSettings(): Promise<AdminSettingsPack> {
  const authConfigured = isSupabaseConfigured
  const verification = isVerificationBackendAvailable()
  const refunds = isRefundApiAvailable()
  const payouts = isPayoutInfrastructureAvailable()
  const exportOk = isFinancialExportAvailable()
  const feeSet = Boolean(import.meta.env.VITE_PLATFORM_FEE_BPS)

  let paymentsFailed = false
  let ledgerAvailable = false
  let providerName: string | null = null
  try {
    const index = await loadAdminPaymentIndex()
    ledgerAvailable = index.available
    providerName = index.provider
  } catch {
    paymentsFailed = true
  }

  const paymentProvider = ledgerAvailable && providerName
    ? row({ key: 'pay-provider', label: 'Payment provider', value: 'Configured', badge: 'configured', source: 'Backend', description: 'Provider identity is recorded on ledger rows. Secrets are not shown.' })
    : row({ key: 'pay-provider', label: 'Payment provider', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' })

  const panels: SettingsPanel[] = [
    panel({
      id: 'general',
      title: 'General',
      intro: 'Platform identity and operational defaults.',
      note: 'These values are managed by application configuration. No writable platform-settings backend is connected.',
      links: [{ label: 'Admin Profile →', href: '/admin/profile' }],
      rows: [
        row({ key: 'name', label: 'Platform name', value: 'LearnSyra', badge: 'managed', source: 'Application' }),
        row({ key: 'description', label: 'Platform description', value: 'Managed by platform configuration', badge: 'managed', source: 'Application' }),
        row({ key: 'language', label: 'Default language', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'timezone', label: 'Default timezone', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'support', label: 'Support email', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'currency', label: 'Default currency', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
      ],
    }),
    panel({
      id: 'branding',
      title: 'Branding',
      intro: 'Current LearnSyra branding as defined in the application.',
      note: 'Branding is currently managed by application configuration. This page does not upload a global logo or change student/tutor chrome.',
      links: [],
      rows: [
        row({ key: 'logo', label: 'Logo', value: 'Application asset', badge: 'managed', source: 'Application', description: 'Shown from the existing LearnSyra mark. No branding upload is connected.' }),
        row({ key: 'brand-name', label: 'Platform name', value: 'LearnSyra', badge: 'managed', source: 'Application' }),
        row({ key: 'tagline', label: 'Tagline', value: 'Managed by application configuration', badge: 'managed', source: 'Application' }),
        row({ key: 'favicon', label: 'Favicon', value: 'Managed by application configuration', badge: 'managed', source: 'Application' }),
        row({ key: 'accent', label: 'Accent configuration', value: 'Managed by application configuration', badge: 'managed', source: 'Application' }),
      ],
    }),
    panel({
      id: 'learning',
      title: 'Learning',
      intro: 'Course, project, and certificate behavior.',
      note: 'Learning configuration is managed by the application. LearnSyra course completion is not an official external credential.',
      links: [
        { label: 'Courses →', href: '/admin/courses' },
        { label: 'Projects →', href: '/admin/projects' },
      ],
      rows: [
        row({ key: 'publish', label: 'Course publishing defaults', value: 'Managed by application', badge: 'managed', source: 'Application' }),
        row({ key: 'projects', label: 'Project availability', value: 'Managed by application', badge: 'managed', source: 'Application' }),
        row({ key: 'progress', label: 'Learning progress rules', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'certs', label: 'Certificate behavior', value: 'Course record only', badge: 'read-only', source: 'Application', description: 'LearnSyra course completion is not an official external credential.' }),
        row({ key: 'tutor-course', label: 'Tutor-created course defaults', value: 'Managed by Course Studio', badge: 'managed', source: 'Application' }),
      ],
    }),
    panel({
      id: 'marketplace',
      title: 'Tutor Marketplace',
      intro: 'Platform-level marketplace policy. Individual tutor settings stay on each tutor workspace.',
      note: 'Marketplace configuration is not connected. This page does not override /tutor/profile or /tutor/settings.',
      links: [{ label: 'Tutors →', href: '/admin/tutors' }],
      rows: [
        row({ key: 'discovery', label: 'Tutor discovery', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'publish-rules', label: 'Tutor publishing rules', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'visibility', label: 'Marketplace visibility', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'profile-req', label: 'Tutor profile requirements', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'booking-avail', label: 'Booking availability policy', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
      ],
    }),
    panel({
      id: 'sessions',
      title: 'Sessions & Booking',
      intro: 'Platform booking and live-session policy.',
      note: 'Booking configuration is managed by the existing booking system. This page does not create a second booking engine or change existing bookings.',
      links: [{ label: 'Sessions →', href: '/admin/sessions' }],
      rows: [
        row({ key: 'booking-on', label: 'Booking enabled', value: 'Managed by the booking system', badge: 'managed', source: 'Application' }),
        row({ key: 'notice', label: 'Minimum booking notice', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'cancel', label: 'Cancellation policy', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'types', label: 'Session types', value: 'Managed by the booking system', badge: 'managed', source: 'Application' }),
        row({ key: 'live', label: 'Live session behavior', value: 'Managed by the live system', badge: 'managed', source: 'Application' }),
      ],
    }),
    panel({
      id: 'notifications',
      title: 'Notifications',
      intro: 'Delivery channels for platform notices.',
      note: 'Notification delivery is not connected. In-app notification records can exist without email or SMS delivery.',
      links: [],
      rows: [
        row({ key: 'email', label: 'Email notifications', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'booking-n', label: 'Booking notifications', value: 'In-app records only', badge: 'managed', source: 'Application', description: 'Booking status updates can write in-app notifications. Email delivery is not connected.' }),
        row({ key: 'reminders', label: 'Session reminders', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'course-n', label: 'Course notifications', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'admin-n', label: 'Admin alerts', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
      ],
    }),
    panel({
      id: 'ai',
      title: 'AI & Learning',
      intro: 'Global AI feature controls.',
      note: 'AI feature controls are managed by application configuration. This page does not add local-only global AI toggles.',
      links: [],
      rows: [
        row({ key: 'ai-learn', label: 'AI Learning', value: 'Managed by application configuration', badge: 'managed', source: 'Application' }),
        row({ key: 'copilot', label: 'Teaching Copilot', value: 'Managed by application configuration', badge: 'managed', source: 'Application' }),
        row({ key: 'career-ai', label: 'Career AI', value: 'Managed by application configuration', badge: 'managed', source: 'Application' }),
        row({ key: 'interview-ai', label: 'AI Interview', value: 'Managed by application configuration', badge: 'managed', source: 'Application' }),
        row({ key: 'suggest', label: 'AI suggestions', value: 'Managed by application configuration', badge: 'managed', source: 'Application' }),
        row({ key: 'ai-provider', label: 'AI provider', value: 'Unavailable', badge: 'unavailable', source: 'Unavailable', description: 'Provider secrets are not exposed in Admin Settings.' }),
      ],
    }),
    panel({
      id: 'security',
      title: 'Security',
      intro: 'Authentication and access configuration. Secrets are never displayed.',
      note: 'Security configuration unavailable for password policy, 2FA, device logs, and scans. Admin access uses the existing role guard.',
      links: [{ label: 'Admin Profile →', href: '/admin/profile' }],
      rows: [
        row({
          key: 'auth',
          label: 'Authentication provider',
          value: authConfigured ? 'Supabase Auth' : 'Not configured',
          badge: authConfigured ? 'configured' : 'not-connected',
          source: authConfigured ? 'Environment' : 'Unavailable',
          description: 'Presence of application auth configuration only. Connection strings and keys are not shown.',
        }),
        row({ key: 'session', label: 'Session policy', value: 'Managed by application', badge: 'managed', source: 'Application' }),
        row({ key: 'password', label: 'Password policy', value: 'Unavailable', badge: 'unavailable', source: 'Unavailable' }),
        row({ key: '2fa', label: '2FA availability', value: 'Unavailable', badge: 'unavailable', source: 'Unavailable' }),
        row({ key: 'login', label: 'Login protection', value: 'Unavailable', badge: 'unavailable', source: 'Unavailable' }),
        row({ key: 'admin-access', label: 'Admin access', value: 'Role guard (admin)', badge: 'managed', source: 'Application' }),
        row({ key: 'google', label: 'Google sign-in', value: 'Managed by application configuration', badge: 'managed', source: 'Application', description: 'The client includes a Google OAuth call. Dashboard enablement is not confirmed from this page.' }),
      ],
    }),
    panel({
      id: 'privacy',
      title: 'Privacy',
      intro: 'Platform privacy policy. Individual student and tutor privacy is not edited here.',
      note: 'Privacy defaults are not backed by a writable platform configuration store.',
      links: [],
      rows: [
        row({ key: 'visibility', label: 'Profile visibility defaults', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'retention', label: 'Data retention', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'analytics', label: 'Analytics collection', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'public', label: 'Public profile behavior', value: 'Managed by application', badge: 'managed', source: 'Application' }),
        row({ key: 'policy', label: 'Privacy policy link', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
      ],
    }),
    panel({
      id: 'payments',
      title: 'Payments',
      intro: 'Payment infrastructure used by the Admin Payments center.',
      note: paymentsFailed ? 'Settings unavailable.' : 'No fake payment provider is shown. Secrets are never displayed.',
      failed: paymentsFailed,
      links: [{ label: 'View Payments →', href: '/admin/payments' }],
      rows: paymentsFailed ? [] : [
        row({ key: 'ledger', label: 'Payment ledger', value: ledgerAvailable ? 'Connected' : 'Unavailable', badge: ledgerAvailable ? 'connected' : 'unavailable', source: ledgerAvailable ? 'Backend' : 'Unavailable' }),
        paymentProvider,
        row({ key: 'refunds', label: 'Refunds', value: refunds ? 'Connected' : 'Not connected', badge: refunds ? 'connected' : 'not-connected', source: 'Unavailable' }),
        row({ key: 'payouts', label: 'Payouts', value: payouts ? 'Connected' : 'Unavailable', badge: payouts ? 'connected' : 'unavailable', source: 'Unavailable' }),
        row({ key: 'fin-report', label: 'Financial reporting', value: exportOk ? 'Connected' : 'Not connected', badge: exportOk ? 'connected' : 'not-connected', source: 'Unavailable' }),
        row({
          key: 'fee',
          label: 'Platform fee',
          value: feeSet ? 'Configured' : 'Not configured',
          badge: feeSet ? 'configured' : 'not-connected',
          source: feeSet ? 'Environment' : 'Unavailable',
          description: 'Environment presence only. The numeric rate is not displayed here.',
        }),
      ],
    }),
    panel({
      id: 'verification',
      title: 'Verification',
      intro: 'Tutor verification infrastructure.',
      note: verification ? 'A verification API flag is present. Workflow records still come from the verification center.' : 'Verification backend unavailable. This page cannot mark tutors Verified.',
      links: [{ label: 'View Verification →', href: '/admin/verification' }],
      rows: [
        row({ key: 'v-provider', label: 'Verification provider', value: verification ? 'Configured' : 'Not connected', badge: verification ? 'configured' : 'not-connected', source: verification ? 'Environment' : 'Unavailable' }),
        row({ key: 'v-queue', label: 'Verification queue', value: verification ? 'See verification center' : 'Unavailable', badge: verification ? 'managed' : 'unavailable', source: verification ? 'Application' : 'Unavailable' }),
        row({ key: 'v-docs', label: 'Documents', value: 'Unavailable', badge: 'unavailable', source: 'Unavailable' }),
        row({ key: 'v-flow', label: 'Approval workflow', value: verification ? 'Managed by verification center' : 'Unavailable', badge: verification ? 'managed' : 'unavailable', source: verification ? 'Application' : 'Unavailable' }),
      ],
    }),
    panel({
      id: 'integrations',
      title: 'Integrations',
      intro: 'Connection status derived from real configuration only.',
      note: 'Frontend code is not treated as a live connection. Secrets are never shown.',
      links: [
        { label: 'Payments →', href: '/admin/payments' },
        { label: 'Verification →', href: '/admin/verification' },
        { label: 'Analytics →', href: '/admin/analytics' },
      ],
      rows: [
        row({ key: 'i-pay', label: 'Payments', value: ledgerAvailable ? 'Connected' : 'Unavailable', badge: ledgerAvailable ? 'connected' : 'unavailable', source: ledgerAvailable ? 'Backend' : 'Unavailable' }),
        row({ key: 'i-auth', label: 'Authentication', value: authConfigured ? 'Configured' : 'Not configured', badge: authConfigured ? 'configured' : 'not-connected', source: authConfigured ? 'Environment' : 'Unavailable' }),
        row({ key: 'i-email', label: 'Email', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'i-ai', label: 'AI provider', value: 'Unavailable', badge: 'unavailable', source: 'Unavailable' }),
        row({ key: 'i-storage', label: 'Storage', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'i-analytics', label: 'Analytics', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'i-verify', label: 'Verification', value: verification ? 'Configured' : 'Not connected', badge: verification ? 'configured' : 'not-connected', source: verification ? 'Environment' : 'Unavailable' }),
      ],
    }),
    panel({
      id: 'features',
      title: 'Platform Features',
      intro: 'Product surfaces currently shipped in the application.',
      note: 'Global feature flags are not connected. These rows are not toggles and do not write localStorage flags.',
      links: [{ label: 'Analytics →', href: '/admin/analytics' }],
      rows: [
        row({ key: 'f-ai', label: 'AI Learning', value: 'Currently available', badge: 'managed', source: 'Application' }),
        row({ key: 'f-market', label: 'Tutor Marketplace', value: 'Currently available', badge: 'managed', source: 'Application' }),
        row({ key: 'f-live', label: 'Live Sessions', value: 'Currently available', badge: 'managed', source: 'Application' }),
        row({ key: 'f-career', label: 'Career Center', value: 'Currently available', badge: 'managed', source: 'Application' }),
        row({ key: 'f-projects', label: 'Projects', value: 'Currently available', badge: 'managed', source: 'Application' }),
        row({ key: 'f-courses', label: 'Courses', value: 'Currently available', badge: 'managed', source: 'Application' }),
      ],
    }),
    panel({
      id: 'maintenance',
      title: 'Maintenance',
      intro: 'Platform availability controls.',
      note: 'Maintenance controls are not connected. A local toggle would not place LearnSyra into maintenance.',
      links: [{ label: 'Audit Logs →', href: '/admin/audit' }],
      rows: [
        row({ key: 'maint', label: 'Maintenance mode', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'maint-msg', label: 'Maintenance message', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
        row({ key: 'maint-sched', label: 'Scheduled maintenance', value: 'Not connected', badge: 'not-connected', source: 'Unavailable' }),
      ],
    }),
  ]

  return { panels, writable: false, auditAvailable: false }
}
