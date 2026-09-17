/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: 'public' | 'admin'
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_PLATFORM_FEE_BPS?: string
  readonly VITE_VERIFICATION_API?: string
  /** Dev only: set to "true" to show legacy mock job catalog when Supabase jobs table is empty. */
  readonly VITE_DEV_MOCK_JOBS?: string
  /** Minimum match score (0–100) for production job recommendations. Default: 35 */
  readonly VITE_JOB_MATCH_MIN_SCORE?: string
}
