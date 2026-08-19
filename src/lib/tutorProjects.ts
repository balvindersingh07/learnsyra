import type { ProjectRow, StudentProjectRow, ProfileLite } from './api'
import {
  buildProjectCatalog,
  getProjectById,
  loadAllProgress,
  loadPortfolioIds,
  progressPct,
  saveAllProgress,
  savePortfolioIds,
  treeFromFiles,
  type CatalogProject,
  type ProjectDifficulty,
  type ProjectFile,
  type ProjectProgress,
} from './projectWorkspace'
import type { TutorStudent } from './tutorStudents'

export type ReviewUiStatus = 'needs_review' | 'in_review' | 'changes' | 'approved' | 'portfolio'
export type ReviewTab = 'all' | ReviewUiStatus
export type ReviewSort = 'priority' | 'newest' | 'oldest' | 'low' | 'high' | 'updated'
export type DateFilter = 'all' | 'today' | 'week' | 'month' | 'older'
export type RubricKey = 'functionality' | 'quality' | 'architecture' | 'testing' | 'docs' | 'ux' | 'a11y'

export const REVIEW_PAGE_SIZE = 20
export const REVIEW_SKILLS = ['React', 'JavaScript', 'TypeScript', 'Node.js', 'Python', 'REST APIs', 'Testing'] as const
export const RUBRIC_MAX: Record<RubricKey, number> = {
  functionality: 25,
  quality: 20,
  architecture: 15,
  testing: 15,
  docs: 10,
  ux: 10,
  a11y: 5,
}

export interface InlineComment {
  id: string
  file: string
  line: number | null
  target: 'file' | 'line' | 'milestone' | 'readme'
  body: string
  kind: 'comment' | 'concern' | 'approve'
  status: 'open' | 'resolved'
  createdAt: string
}

export interface ReviewHistoryItem {
  at: string
  status: ReviewUiStatus
  summary: string
  score: number | null
}

export interface ReviewVersion {
  n: number
  at: string
  status: ReviewUiStatus
}

export interface RubricScores {
  functionality: number | null
  quality: number | null
  architecture: number | null
  testing: number | null
  docs: number | null
  ux: number | null
  a11y: number | null
}

export interface ReviewExtras {
  status: ReviewUiStatus | null
  well: string
  improve: string
  next: string
  privateNote: string
  actionItems: string[]
  comments: InlineComment[]
  history: ReviewHistoryItem[]
  versions: ReviewVersion[]
  changeSummary: string
  ignoredFocus: string[]
  followUp: boolean
  studentRequested: boolean
  sentFeedback: string | null
  rubric: RubricScores
  milestoneNotes: Record<string, string>
  inReviewAt: string | null
  reviewedAt: string | null
}

export interface AiFinding {
  category: string
  tone: 'good' | 'improve' | 'review'
  label: string
  evidence: string
}

export interface AiPreReview {
  inspected: boolean
  summary: string
  findings: AiFinding[]
  focus: string[]
  queueHint: 'quality' | 'testing' | 'ready'
}

export interface TutorProjectReview {
  id: string
  source: 'api' | 'demo'
  demo: boolean
  projectId: string
  apiRowId: string | null
  studentId: string
  studentName: string
  studentAvatar: string | null
  courseTitle: string | null
  courseId: string | null
  title: string
  difficulty: ProjectDifficulty
  status: ReviewUiStatus
  submittedAt: string | null
  skills: string[]
  progress: number | null
  submissionUrl: string | null
  reviewNote: string | null
  priorityReason: string | null
  catalog: CatalogProject | null
}

const EXTRAS_KEY = (tutorId: string) => `learnsyra_tutor_project_reviews_${tutorId}`
const FILTER_KEY = 'learnsyra_tutor_project_filters'

const EMPTY_RUBRIC: RubricScores = {
  functionality: null,
  quality: null,
  architecture: null,
  testing: null,
  docs: null,
  ux: null,
  a11y: null,
}

export const EMPTY_EXTRAS: ReviewExtras = {
  status: null,
  well: '',
  improve: '',
  next: '',
  privateNote: '',
  actionItems: [],
  comments: [],
  history: [],
  versions: [],
  changeSummary: '',
  ignoredFocus: [],
  followUp: false,
  studentRequested: false,
  sentFeedback: null,
  rubric: { ...EMPTY_RUBRIC },
  milestoneNotes: {},
  inReviewAt: null,
  reviewedAt: null,
}

function loadMap(tutorId: string): Record<string, ReviewExtras> {
  try {
    const raw = localStorage.getItem(EXTRAS_KEY(tutorId))
    return raw ? (JSON.parse(raw) as Record<string, ReviewExtras>) : {}
  } catch {
    return {}
  }
}

export function loadReviewExtras(tutorId: string, id: string): ReviewExtras {
  const stored = loadMap(tutorId)[id]
  return {
    ...EMPTY_EXTRAS,
    ...stored,
    rubric: { ...EMPTY_RUBRIC, ...stored?.rubric },
    actionItems: stored?.actionItems ?? [],
    comments: stored?.comments ?? [],
    history: stored?.history ?? [],
    versions: stored?.versions ?? [],
    ignoredFocus: stored?.ignoredFocus ?? [],
    milestoneNotes: stored?.milestoneNotes ?? {},
  }
}

export function saveReviewExtras(tutorId: string, id: string, extras: ReviewExtras) {
  const map = loadMap(tutorId)
  map[id] = extras
  localStorage.setItem(EXTRAS_KEY(tutorId), JSON.stringify(map))
}

export function loadReviewFilters(): Partial<{ tab: ReviewTab; query: string; sort: ReviewSort; skill: string; course: string; difficulty: string; date: DateFilter }> {
  try {
    const raw = sessionStorage.getItem(FILTER_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveReviewFilters(next: object) {
  sessionStorage.setItem(FILTER_KEY, JSON.stringify(next))
}

export function statusLabel(status: ReviewUiStatus) {
  if (status === 'in_review') return 'In Review'
  if (status === 'changes') return 'Changes Requested'
  if (status === 'approved') return 'Approved'
  if (status === 'portfolio') return 'Portfolio Ready'
  return 'Needs Review'
}

export function statusDot(status: ReviewUiStatus) {
  if (status === 'in_review') return '🔵'
  if (status === 'changes') return '🟠'
  if (status === 'approved') return '🟢'
  if (status === 'portfolio') return '🚀'
  return '🟡'
}

export function rubricTotal(r: RubricScores) {
  const vals = Object.values(r)
  if (vals.some(v => v == null)) return null
  return vals.reduce((s, n) => s + (n ?? 0), 0)
}

function mapApiStatus(row: StudentProjectRow, extras: ReviewExtras, projectId: string): ReviewUiStatus {
  if (extras.status) return extras.status
  const portfolio = loadPortfolioIds().includes(projectId)
  if (row.status === 'completed' && portfolio) return 'portfolio'
  if (row.status === 'completed') return 'approved'
  return 'needs_review'
}

export function availableFiles(project: CatalogProject | null, progress: ProjectProgress | null): { files: ProjectFile[]; source: 'workspace' | 'starter' | 'none'; note: string } {
  if (progress && Object.keys(progress.files).length) {
    const files = Object.entries(progress.files).map(([path, content]) => ({
      path,
      language: (path.endsWith('.md') ? 'md' : path.endsWith('.css') ? 'css' : path.endsWith('.json') ? 'json' : path.endsWith('.jsx') ? 'jsx' : 'js') as ProjectFile['language'],
      content,
    }))
    const sameAsStarter =
      project?.files.every(f => (progress.files[f.path] ?? '') === f.content) &&
      Object.keys(progress.files).length === (project?.files.length ?? 0)
    return {
      files,
      source: sameAsStarter ? 'starter' : 'workspace',
      note: sameAsStarter
        ? 'These match the starter files. Student edits may not be available in this environment.'
        : 'Files from the project workspace on this device.',
    }
  }
  if (project?.files.length) {
    return {
      files: project.files,
      source: 'starter',
      note: 'Canonical starter files. Student submission files are not available in this environment.',
    }
  }
  return { files: [], source: 'none', note: 'Submission files are not available in this environment.' }
}

export function buildAiPreReview(files: ProjectFile[], source: 'workspace' | 'starter' | 'none', ranSuccessfully: boolean | null): AiPreReview {
  if (source === 'none' || !files.length) {
    return {
      inspected: false,
      summary: 'AI could not inspect project files.',
      findings: [
        { category: 'Code Quality', tone: 'review', label: 'Needs Review', evidence: 'AI could not inspect project files.' },
        { category: 'Structure', tone: 'review', label: 'Needs Review', evidence: 'No file tree was available.' },
        { category: 'Testing', tone: 'review', label: 'Needs Review', evidence: 'AI could not inspect project files.' },
        { category: 'Documentation', tone: 'review', label: 'Needs Review', evidence: 'AI could not inspect project files.' },
        { category: 'Accessibility', tone: 'review', label: 'Needs Review', evidence: 'AI could not inspect project files.' },
        { category: 'Error Handling', tone: 'review', label: 'Needs Review', evidence: 'AI could not inspect project files.' },
      ],
      focus: ['Ask the student to share a README and a way to inspect files before scoring.'],
      queueHint: 'quality',
    }
  }
  const blob = files.map(f => `${f.path}\n${f.content}`).join('\n')
  const paths = files.map(f => f.path.toLowerCase())
  const hasTestFile = paths.some(p => /test|spec/.test(p))
  const readme = files.find(f => /readme/i.test(f.path))
  const readmeLong = (readme?.content ?? '').trim().length > 80
  const hasCatch = /\bcatch\s*\(|try\s*\{/.test(blob)
  const hasA11y = /aria-|alt=|label/i.test(blob)
  const components = paths.filter(p => /component|\.jsx$/.test(p)).length
  const findings: AiFinding[] = [
    {
      category: 'Code Quality',
      tone: files.some(f => f.content.trim().length > 20) ? 'good' : 'improve',
      label: files.some(f => f.content.trim().length > 20) ? 'Good' : 'Needs Improvement',
      evidence: files.some(f => f.content.trim().length > 20) ? `${files.length} files are available to read.` : 'Available files are empty or stubs.',
    },
    {
      category: 'Structure',
      tone: components || paths.some(p => p.includes('src/')) ? 'good' : 'improve',
      label: components || paths.some(p => p.includes('src/')) ? 'Good' : 'Needs Improvement',
      evidence: paths.some(p => p.includes('src/')) ? 'A src/ folder is present in the file tree.' : 'No src/ structure was detected in available files.',
    },
    {
      category: 'Testing',
      tone: hasTestFile ? 'good' : 'improve',
      label: hasTestFile ? 'Good' : 'Needs Improvement',
      evidence: hasTestFile ? 'A test or spec file is present in the tree.' : 'Tests directory or spec files were not detected in available files.',
    },
    {
      category: 'Documentation',
      tone: readmeLong ? 'good' : 'improve',
      label: readmeLong ? 'Good' : 'Needs Improvement',
      evidence: readme ? (readmeLong ? 'README.md has setup-style content.' : 'README exists but is a short stub.') : 'No README.md was found in available files.',
    },
    {
      category: 'Accessibility',
      tone: hasA11y ? 'good' : 'improve',
      label: hasA11y ? 'Good' : 'Could Improve',
      evidence: hasA11y ? 'Available files mention labels or alt/aria attributes.' : 'No alt/aria/label attributes were found in available files.',
    },
    {
      category: 'Error Handling',
      tone: hasCatch ? 'good' : 'improve',
      label: hasCatch ? 'Good' : 'Needs Review',
      evidence: hasCatch ? 'try/catch appears in available files.' : 'No try/catch was found in available files.',
    },
  ]
  if (ranSuccessfully === true) {
    findings.push({
      category: 'Run status',
      tone: 'good',
      label: 'Workspace marked run successful',
      evidence: 'The student workspace recorded a successful run. This is not a tutor-side execution.',
    })
  }
  const focus: string[] = []
  if (!hasCatch) focus.push('Ask student to add API error handling.')
  if (!hasTestFile) focus.push('Review testing approach.')
  if (!readmeLong) focus.push('Improve README setup instructions.')
  if (!focus.length) focus.push('Walk through one milestone with the student and confirm the README matches the build.')
  const queueHint: AiPreReview['queueHint'] = !hasTestFile ? 'testing' : findings.some(f => f.tone === 'improve' && f.category === 'Code Quality') ? 'quality' : !hasCatch ? 'quality' : 'ready'
  const summary = source === 'starter'
    ? 'Pre-review is based on available starter/workspace files, not a live execution.'
    : 'Pre-review used files available in this environment. Tutor still makes the final decision.'
  return { inspected: true, summary, findings, focus, queueHint }
}

function daysAgo(iso: string | null) {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - +new Date(iso)) / 86400000))
}

function sameDay(iso: string, offset = 0) {
  const a = new Date(iso)
  const b = new Date()
  b.setDate(b.getDate() + offset)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function inThisWeek(iso: string) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const day = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - day)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t < end.getTime()
}

export function priorityReason(view: TutorProjectReview, student: TutorStudent | undefined, extras: ReviewExtras) {
  if (student?.nextSession?.upcoming) return `Student has a session ${formatWhenShort(student.nextSession.when)}.`
  if (student?.projects.some(p => p.needsReview) && (student.overallProgress ?? 100) < 80) return 'Project is blocking course completion.'
  if (extras.followUp) return 'You marked this for follow-up.'
  if (extras.studentRequested) return 'Student requested review.'
  const wait = daysAgo(view.submittedAt)
  if (wait >= 2) return `Submission waiting ${wait} days.`
  return null
}

function formatWhenShort(iso: string) {
  if (sameDay(iso)) return 'today'
  if (sameDay(iso, 1)) return 'tomorrow'
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short' })
}

export function formatSubmitted(iso: string | null) {
  if (!iso) return 'Date not recorded'
  if (sameDay(iso)) return 'Today'
  if (sameDay(iso, -1)) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function buildReviews(input: {
  queue: (StudentProjectRow & { project: ProjectRow | null; student: ProfileLite | null })[]
  roster: TutorStudent[]
  apiProjects: ProjectRow[]
  tutorId: string
}): { reviews: TutorProjectReview[]; source: 'live' | 'demo' } {
  const catalog = buildProjectCatalog(input.apiProjects)
  const liveIds = new Set(input.roster.filter(s => !s.demo).map(s => s.id))
  const extrasMap = loadMap(input.tutorId)
  const out: TutorProjectReview[] = []

  if (liveIds.size) {
    for (const row of input.queue) {
      if (!liveIds.has(row.student_id)) continue
    const project = getProjectById(catalog, row.project_id) ?? catalog.find(p => p.title === row.project?.title) ?? null
    const student = input.roster.find(s => s.id === row.student_id)
    const extras = { ...EMPTY_EXTRAS, ...(extrasMap[row.id] ?? {}) }
    const progress = loadAllProgress()[row.project_id]
    const view: TutorProjectReview = {
      id: row.id,
      source: 'api',
      demo: false,
      projectId: row.project_id,
      apiRowId: row.id,
      studentId: row.student_id,
      studentName: student?.name || row.student?.full_name || 'Student',
      studentAvatar: student?.avatarUrl || row.student?.avatar_url || null,
      courseTitle: student?.courses[0]?.title ?? null,
      courseId: student?.courses[0]?.id ?? null,
      title: project?.title || row.project?.title || 'Project',
      difficulty: project?.difficulty ?? 'Intermediate',
      status: mapApiStatus(row, extras, row.project_id),
      submittedAt: row.submitted_at,
      skills: project?.skills ?? [],
      progress: project && progress ? progressPct(project, progress) : null,
      submissionUrl: row.submission_url,
      reviewNote: row.review_note,
      priorityReason: null,
      catalog: project,
    }
      view.priorityReason = priorityReason(view, student, extras)
      out.push(view)
    }
    return { reviews: out, source: 'live' }
  }
  return { reviews: demoReviews(input.roster, catalog).map(d => {
    const st = extrasMap[d.id]?.status
    return st ? { ...d, status: st } : d
  }), source: 'demo' }
}

function demoReviews(roster: TutorStudent[], catalog: CatalogProject[]): TutorProjectReview[] {
  const alex = roster.find(s => s.id === 'demo-alex') || roster[0]
  const meera = roster.find(s => s.id === 'demo-meera')
  const expense = catalog.find(p => /expense/i.test(p.title)) || catalog[0]
  const auth = catalog.find(p => /auth/i.test(p.title))
  const rows: TutorProjectReview[] = []
  if (expense && alex) {
    rows.push({
      id: 'review-demo-alex',
      source: 'demo',
      demo: true,
      projectId: expense.id,
      apiRowId: null,
      studentId: alex.id,
      studentName: alex.name,
      studentAvatar: alex.avatarUrl,
      courseTitle: alex.courses[0]?.title ?? 'Full Stack Web Development',
      courseId: alex.courses[0]?.id ?? null,
      title: expense.title,
      difficulty: expense.difficulty,
      status: 'needs_review',
      submittedAt: new Date().toISOString(),
      skills: expense.skills,
      progress: 92,
      submissionUrl: null,
      reviewNote: null,
      priorityReason: alex.nextSession?.upcoming ? `Student has a session ${formatWhenShort(alex.nextSession.when)}.` : 'Labeled sample for the review workspace.',
      catalog: expense,
    })
  }
  if (auth && meera) {
    rows.push({
      id: 'review-demo-meera',
      source: 'demo',
      demo: true,
      projectId: auth.id,
      apiRowId: null,
      studentId: meera.id,
      studentName: meera.name,
      studentAvatar: meera.avatarUrl,
      courseTitle: meera.courses[0]?.title ?? null,
      courseId: meera.courses[0]?.id ?? null,
      title: auth.title,
      difficulty: auth.difficulty,
      status: 'changes',
      submittedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      skills: auth.skills,
      progress: 54,
      submissionUrl: null,
      reviewNote: null,
      priorityReason: 'Project is blocking course completion.',
      catalog: auth,
    })
  }
  return rows
}

export function reviewStats(rows: TutorProjectReview[]) {
  const real = rows.filter(r => !r.demo)
  const list = real.length ? real : []
  const count = (s: ReviewUiStatus) => list.filter(r => r.status === s).length
  return {
    needs: count('needs_review'),
    inReview: count('in_review'),
    changes: count('changes'),
    approved: count('approved'),
    portfolio: count('portfolio'),
    usingDemo: !real.length,
  }
}

export function matchesQuery(row: TutorProjectReview, q: string) {
  if (!q.trim()) return true
  const blob = [row.title, row.studentName, row.courseTitle, row.status, statusLabel(row.status), ...row.skills].join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).every(w => blob.includes(w))
}

export function matchesReviewFilters(
  row: TutorProjectReview,
  opts: { tab: ReviewTab; skill: string; course: string; difficulty: string; date: DateFilter },
) {
  if (opts.tab !== 'all' && row.status !== opts.tab) return false
  if (opts.skill && !row.skills.some(s => s.toLowerCase().includes(opts.skill.toLowerCase()))) return false
  if (opts.course && (row.courseTitle || '') !== opts.course) return false
  if (opts.difficulty && row.difficulty !== opts.difficulty) return false
  if (opts.date !== 'all') {
    if (!row.submittedAt) return false
    if (opts.date === 'today' && !sameDay(row.submittedAt)) return false
    if (opts.date === 'week' && !inThisWeek(row.submittedAt)) return false
    if (opts.date === 'month') {
      const d = new Date(row.submittedAt)
      const now = new Date()
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false
    }
    if (opts.date === 'older') {
      const d = new Date(row.submittedAt)
      const now = new Date()
      const older = d.getFullYear() < now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth())
      if (!older) return false
    }
  }
  return true
}

export function sortReviews(rows: TutorProjectReview[], key: ReviewSort, tutorId: string) {
  const copy = [...rows]
  copy.sort((a, b) => {
    if (key === 'newest') return +(new Date(b.submittedAt || 0)) - +(new Date(a.submittedAt || 0))
    if (key === 'oldest') return +(new Date(a.submittedAt || 0)) - +(new Date(b.submittedAt || 0))
    if (key === 'updated') {
      const ua = loadReviewExtras(tutorId, a.id).reviewedAt || a.submittedAt || ''
      const ub = loadReviewExtras(tutorId, b.id).reviewedAt || b.submittedAt || ''
      return +new Date(ub) - +new Date(ua)
    }
    if (key === 'low' || key === 'high') {
      const sa = rubricTotal(loadReviewExtras(tutorId, a.id).rubric)
      const sb = rubricTotal(loadReviewExtras(tutorId, b.id).rubric)
      if (sa == null && sb == null) return 0
      if (sa == null) return 1
      if (sb == null) return -1
      return key === 'low' ? sa - sb : sb - sa
    }
    const pa = a.priorityReason ? 0 : 1
    const pb = b.priorityReason ? 0 : 1
    if (pa !== pb) return pa - pb
    return daysAgo(b.submittedAt) - daysAgo(a.submittedAt)
  })
  return copy
}

export function aiQueueBreakdown(rows: TutorProjectReview[]) {
  const waiting = rows.filter(r => r.status === 'needs_review' || r.status === 'in_review')
  let quality = 0
  let testing = 0
  let ready = 0
  for (const r of waiting) {
    const files = availableFiles(r.catalog, loadAllProgress()[r.projectId] ?? null)
    const ai = buildAiPreReview(files.files, files.source, loadAllProgress()[r.projectId]?.ranSuccessfully ?? null)
    if (ai.queueHint === 'testing') testing += 1
    else if (ai.queueHint === 'ready') ready += 1
    else quality += 1
  }
  return { waiting: waiting.length, quality, testing, ready }
}

export function studentVisibleFeedback(extras: ReviewExtras) {
  return [extras.well && `Great work: ${extras.well}`, extras.improve && extras.improve, extras.next && `Next: ${extras.next}`, extras.actionItems.length ? extras.actionItems.map(a => `• ${a}`).join('\n') : '']
    .filter(Boolean)
    .join('\n\n')
}

export function applyApproveToWorkspace(projectId: string, score: number | null) {
  const all = loadAllProgress()
  const cur = all[projectId]
  if (!cur) return
  all[projectId] = {
    ...cur,
    status: 'completed',
    completedAt: new Date().toISOString(),
    score: score ?? cur.score,
  }
  saveAllProgress(all)
}

export function addToPortfolio(projectId: string) {
  const ids = loadPortfolioIds()
  if (!ids.includes(projectId)) savePortfolioIds([...ids, projectId])
  const all = loadAllProgress()
  if (all[projectId]) {
    all[projectId] = { ...all[projectId], inPortfolio: true, status: 'completed' }
    saveAllProgress(all)
  }
}

export function fileTree(files: ProjectFile[]) {
  return treeFromFiles(files)
}

export { loadPortfolioIds }
