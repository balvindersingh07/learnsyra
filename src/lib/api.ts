import { supabase, isSupabaseConfigured } from './supabase'
import type { PlanId } from './supabase'

export type { PlanId }

export interface CourseRow {
  id: string
  tutor_id: string | null
  title: string
  description: string | null
  category: string | null
  level: string | null
  price_cents: number
  is_premium: boolean
  rating: number
  thumbnail_url: string | null
  published: boolean
  created_at: string
}

export interface ProjectRow {
  id: string
  title: string
  description: string | null
  difficulty: string | null
  skills: string[]
  created_at: string
}

export interface EnrollmentRow {
  id: string
  student_id: string
  course_id: string
  progress: number
  last_lesson_id: string | null
  enrolled_at: string
}

export interface CourseLesson {
  id: string
  module_id: string
  title: string
  lesson_type: 'video' | 'quiz' | 'project'
  duration_min: number
  sort_order: number
  is_free: boolean
  body: string | null
  video_url: string | null
  quiz: {
    pass: number
    questions: { q: string; options: string[]; answer: number }[]
  } | null
}

export interface JobRow {
  id: string
  title: string
  company: string
  location: string | null
  salary: string | null
  logo: string | null
  tags: string[]
  apply_url: string | null
}

export interface CourseReview {
  id: string
  course_id: string
  student_id: string
  rating: number
  body: string | null
  created_at: string
  student?: { full_name: string | null; avatar_url: string | null } | null
}

export interface CourseModule {
  id: string
  course_id: string
  title: string
  sort_order: number
  lessons: CourseLesson[]
}

export interface StudentProjectRow {
  id: string
  student_id: string
  project_id: string
  status: 'started' | 'submitted' | 'completed'
  submission_url: string | null
  submitted_at: string | null
  review_note: string | null
  created_at: string
}

export interface ProfileLite {
  id: string
  full_name: string | null
  avatar_url: string | null
  role?: string
  plan?: string
  created_at?: string
  headline?: string | null
}

export interface TutorListing {
  id: string
  profile_id: string | null
  name: string
  expertise: string | null
  intro: string | null
  subject: string | null
  tags: string[]
  hourly_rate_cents: number
  rating: number
  reviews: number
  students_taught: number
  available: boolean
  image_key: string | null
}

export interface BookingRow {
  id: string
  student_id: string
  tutor_listing_id: string
  message: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  created_at: string
  listing?: TutorListing | null
  student?: ProfileLite | null
}

export interface CareerProfile {
  user_id: string
  readiness_score: number
  target_role: string | null
  resume_text: string | null
  skills: string[]
  updated_at: string
}

export interface NotificationRow {
  id: string
  user_id: string
  title: string
  body: string | null
  href: string | null
  read: boolean
  created_at: string
}

export interface CertificateRow {
  id: string
  student_id: string
  course_id: string | null
  project_id: string | null
  title: string
  issued_at: string
}

export interface AiConversation {
  id: string
  user_id: string
  title: string
  created_at: string
}

export interface AiMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

/** Visual style derived from a course category, so DB rows still render nicely. */
export function categoryStyle(category: string | null): { icon: string; color: string } {
  const map: Record<string, { icon: string; color: string }> = {
    Programming: { icon: '⚡', color: '#6C5CE7' },
    'AI & ML': { icon: '🤖', color: '#8B5CF6' },
    'Data Analytics': { icon: '📊', color: '#22C7D6' },
    Business: { icon: '📈', color: '#20C997' },
    MBA: { icon: '🎓', color: '#20C997' },
    English: { icon: '🗣️', color: '#f59e0b' },
    Mathematics: { icon: '➗', color: '#6C5CE7' },
    Finance: { icon: '💰', color: '#f43f5e' },
    'Career Skills': { icon: '💼', color: '#4F8CFF' },
  }
  return map[category ?? ''] ?? { icon: '📚', color: '#6C5CE7' }
}

export function planLabel(plan: PlanId | string | null | undefined) {
  if (plan === 'student_pro') return 'Student Pro'
  if (plan === 'career_pro') return 'Career Pro'
  return 'Free'
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function notify(title: string, body?: string, href?: string) {
  const uid = await currentUserId()
  if (!uid || !isSupabaseConfigured) return
  await supabase.from('notifications').insert({
    user_id: uid,
    title,
    body: body ?? null,
    href: href ?? null,
  })
}

export async function getCourses(): Promise<CourseRow[]> {
  let rows: CourseRow[] = []
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('published', true)
      .order('title')
    if (error) throw error
    rows = (data as CourseRow[]) ?? []
  }
  const { publishedStudioRows } = await import('./tutorCourses')
  const extra = publishedStudioRows().filter(s => !rows.some(r => r.id === s.id))
  return [...rows, ...extra]
}

export async function getCourse(id: string): Promise<CourseRow | null> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('courses').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (data) return data as CourseRow
  }
  const { findStudioByAnyId, studioToCourseRow } = await import('./tutorCourses')
  const studio = findStudioByAnyId(id)
  return studio ? studioToCourseRow(studio) : null
}

export async function getCourseCurriculum(courseId: string): Promise<CourseModule[]> {
  const { findStudioByAnyId, studioCurriculum } = await import('./tutorCourses')
  const studio = findStudioByAnyId(courseId)
  if (studio?.modules.length) return studioCurriculum(studio)
  if (!isSupabaseConfigured) return []
  const { data: modules, error } = await supabase
    .from('course_modules')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order')
  if (error) throw error
  const mods = (modules as Omit<CourseModule, 'lessons'>[]) ?? []
  if (mods.length === 0) return []
  const { data: lessons, error: lerr } = await supabase
    .from('course_lessons')
    .select('*')
    .in(
      'module_id',
      mods.map(m => m.id),
    )
    .order('sort_order')
  if (lerr) throw lerr
  const byModule = new Map<string, CourseLesson[]>()
  for (const lesson of (lessons as CourseLesson[]) ?? []) {
    const list = byModule.get(lesson.module_id) ?? []
    list.push(lesson)
    byModule.set(lesson.module_id, list)
  }
  return mods.map(m => ({ ...m, lessons: byModule.get(m.id) ?? [] }))
}

export async function getProjects(): Promise<ProjectRow[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('projects').select('*').order('created_at')
  if (error) throw error
  return (data as ProjectRow[]) ?? []
}

export async function getMyEnrollments(): Promise<EnrollmentRow[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('enrollments').select('*')
  if (error) throw error
  return (data as EnrollmentRow[]) ?? []
}

export async function getMyEnrolledCourses(): Promise<
  (CourseRow & { progress: number; last_lesson_id: string | null })[]
> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('enrollments')
    .select('progress, last_lesson_id, course:courses(*)')
    .order('enrolled_at', { ascending: false })
  if (error) throw error
  return (
    (data as unknown as {
      progress: number
      last_lesson_id: string | null
      course: CourseRow
    }[]) ?? []
  )
    .filter(r => r.course)
    .map(r => ({ ...r.course, progress: r.progress, last_lesson_id: r.last_lesson_id }))
}

export async function enrollInCourse(courseId: string): Promise<{ error: string | null }> {
  const uid = await currentUserId()
  if (!uid) return { error: 'Not logged in' }
  const { error } = await supabase
    .from('enrollments')
    .upsert({ student_id: uid, course_id: courseId }, { onConflict: 'student_id,course_id' })
  if (error) return { error: error.message }
  const course = await getCourse(courseId)
  await notify(
    `Enrolled in ${course?.title ?? 'a course'}`,
    'Open the course and complete your first lesson to start tracking progress.',
    `/courses/${courseId}`,
  )
  return { error: null }
}

export async function getCompletedLessonIds(courseId: string): Promise<string[]> {
  const uid = await currentUserId()
  if (!uid || !isSupabaseConfigured) return []
  const curriculum = await getCourseCurriculum(courseId)
  const lessonIds = curriculum.flatMap(m => m.lessons.map(l => l.id))
  if (lessonIds.length === 0) return []
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('student_id', uid)
    .in('lesson_id', lessonIds)
  if (error) throw error
  return ((data as { lesson_id: string }[]) ?? []).map(r => r.lesson_id)
}

export async function completeLesson(
  courseId: string,
  lessonId: string,
): Promise<{ progress: number; certified: boolean; error: string | null }> {
  const uid = await currentUserId()
  if (!uid) return { progress: 0, certified: false, error: 'Not logged in' }

  const { error: pErr } = await supabase
    .from('lesson_progress')
    .upsert({ student_id: uid, lesson_id: lessonId }, { onConflict: 'student_id,lesson_id' })
  if (pErr) return { progress: 0, certified: false, error: pErr.message }

  const curriculum = await getCourseCurriculum(courseId)
  const allLessons = curriculum.flatMap(m => m.lessons)
  const done = await getCompletedLessonIds(courseId)
  const progress = allLessons.length
    ? Math.round((done.length / allLessons.length) * 100)
    : 0

  await supabase
    .from('enrollments')
    .update({ progress, last_lesson_id: lessonId })
    .eq('student_id', uid)
    .eq('course_id', courseId)

  let certified = false
  if (progress >= 100) {
    const course = await getCourse(courseId)
    const { data: existing } = await supabase
      .from('certificates')
      .select('id')
      .eq('student_id', uid)
      .eq('course_id', courseId)
      .maybeSingle()
    if (!existing) {
      await supabase.from('certificates').insert({
        student_id: uid,
        course_id: courseId,
        title: `${course?.title ?? 'Course'} — Certificate of Completion`,
      })
      await notify(
        'Certificate earned',
        `You completed ${course?.title ?? 'the course'}. View it on your profile.`,
        '/profile',
      )
      certified = true
    } else {
      certified = true
    }
  }

  return { progress, certified, error: null }
}

export async function getBookmarks(): Promise<string[]> {
  const uid = await currentUserId()
  if (!uid || !isSupabaseConfigured) return []
  const { data, error } = await supabase.from('bookmarks').select('course_id').eq('student_id', uid)
  if (error) throw error
  return ((data as { course_id: string }[]) ?? []).map(r => r.course_id)
}

export async function toggleBookmark(courseId: string): Promise<boolean> {
  const uid = await currentUserId()
  if (!uid) return false
  const { data: existing } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('student_id', uid)
    .eq('course_id', courseId)
    .maybeSingle()
  if (existing) {
    await supabase.from('bookmarks').delete().eq('id', existing.id)
    return false
  }
  await supabase.from('bookmarks').insert({ student_id: uid, course_id: courseId })
  return true
}

export async function getMyStudentProjects(): Promise<StudentProjectRow[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('student_projects').select('*')
  if (error) throw error
  return (data as StudentProjectRow[]) ?? []
}

export async function startProject(projectId: string): Promise<{ error: string | null }> {
  const uid = await currentUserId()
  if (!uid) return { error: 'Not logged in' }
  const { error } = await supabase.from('student_projects').upsert(
    { student_id: uid, project_id: projectId, status: 'started' },
    { onConflict: 'student_id,project_id' },
  )
  if (error) return { error: error.message }
  const { data: project } = await supabase.from('projects').select('title').eq('id', projectId).maybeSingle()
  await notify('Project started', (project as { title?: string } | null)?.title ?? 'Keep building.', '/projects')
  return { error: null }
}

export async function submitProject(
  projectId: string,
  submissionUrl: string,
): Promise<{ error: string | null }> {
  const uid = await currentUserId()
  if (!uid) return { error: 'Not logged in' }
  const { error } = await supabase
    .from('student_projects')
    .update({
      status: 'submitted',
      submission_url: submissionUrl,
      submitted_at: new Date().toISOString(),
    })
    .eq('student_id', uid)
    .eq('project_id', projectId)
  if (error) return { error: error.message }
  await notify('Project submitted', 'A tutor will review it later. Keep shipping.', '/projects')
  return { error: null }
}

export async function getTutorListings(): Promise<TutorListing[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('tutor_listings').select('*').order('rating', { ascending: false })
  if (error) throw error
  return (data as TutorListing[]) ?? []
}

export async function bookTutor(
  listingId: string,
  message: string,
): Promise<{ error: string | null }> {
  const uid = await currentUserId()
  if (!uid) return { error: 'Not logged in' }
  const { error } = await supabase.from('bookings').insert({
    student_id: uid,
    tutor_listing_id: listingId,
    message: message || null,
    status: 'pending',
  })
  if (error) return { error: error.message }
  await notify('Session requested', 'Your booking is pending tutor confirmation.', '/dashboard')
  return { error: null }
}

export async function getMyBookings(): Promise<BookingRow[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('bookings')
    .select('*, listing:tutor_listings(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as BookingRow[]) ?? []
}

export async function getCareerProfile(): Promise<CareerProfile | null> {
  const uid = await currentUserId()
  if (!uid || !isSupabaseConfigured) return null
  const { data, error } = await supabase.from('career_profiles').select('*').eq('user_id', uid).maybeSingle()
  if (error) throw error
  return (data as CareerProfile) ?? null
}

export async function saveCareerProfile(patch: {
  target_role?: string
  resume_text?: string
  skills?: string[]
  readiness_score?: number
}): Promise<{ error: string | null }> {
  const uid = await currentUserId()
  if (!uid) return { error: 'Not logged in' }
  const { error } = await supabase.from('career_profiles').upsert({
    user_id: uid,
    ...patch,
    updated_at: new Date().toISOString(),
  })
  return { error: error?.message ?? null }
}

export function computeReadiness(input: {
  enrolledCount: number
  avgProgress: number
  submittedProjects: number
  resumeLength: number
  targetRole: string
}) {
  const enroll = Math.min(25, input.enrolledCount * 8)
  const progress = Math.round(input.avgProgress * 0.35)
  const projects = Math.min(20, input.submittedProjects * 10)
  const resume = input.resumeLength > 80 ? 15 : input.resumeLength > 20 ? 8 : 0
  const role = input.targetRole.trim() ? 5 : 0
  return Math.min(100, Math.max(12, enroll + progress + projects + resume + role))
}

export async function getNotifications(): Promise<NotificationRow[]> {
  const uid = await currentUserId()
  if (!uid || !isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) throw error
  return (data as NotificationRow[]) ?? []
}

export async function unreadNotificationCount(): Promise<number> {
  const uid = await currentUserId()
  if (!uid || !isSupabaseConfigured) return 0
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('read', false)
  if (error) return 0
  return count ?? 0
}

export async function markNotificationsRead() {
  const uid = await currentUserId()
  if (!uid) return
  await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false)
}

export async function getCertificates(): Promise<CertificateRow[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .order('issued_at', { ascending: false })
  if (error) throw error
  return (data as CertificateRow[]) ?? []
}

export async function getStudentStats() {
  const uid = await currentUserId()
  if (!uid || !isSupabaseConfigured) {
    return { streak: 0, level: 1, weekHours: 0, careerScore: 0, completedLessons: 0 }
  }
  const { data: progress } = await supabase
    .from('lesson_progress')
    .select('completed_at, lesson_id')
    .eq('student_id', uid)
    .order('completed_at', { ascending: false })

  const rows = (progress as { completed_at: string; lesson_id: string }[]) ?? []
  const days = new Set(rows.map(r => r.completed_at.slice(0, 10)))
  let streak = 0
  const cursor = new Date()
  for (;;) {
    const key = cursor.toISOString().slice(0, 10)
    if (days.has(key)) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekLessonIds = rows.filter(r => new Date(r.completed_at) >= weekAgo).map(r => r.lesson_id)
  let weekMin = 0
  if (weekLessonIds.length) {
    const { data: lessons } = await supabase
      .from('course_lessons')
      .select('duration_min')
      .in('id', weekLessonIds)
    weekMin = ((lessons as { duration_min: number }[]) ?? []).reduce((s, l) => s + l.duration_min, 0)
  }

  const career = await getCareerProfile()
  return {
    streak,
    level: Math.floor(rows.length / 4) + 1,
    weekHours: Math.round((weekMin / 60) * 10) / 10,
    careerScore: career?.readiness_score ?? 0,
    completedLessons: rows.length,
  }
}

export async function listConversations(): Promise<AiConversation[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as AiConversation[]) ?? []
}

export async function getConversationMessages(conversationId: string): Promise<AiMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at')
  if (error) throw error
  return (data as AiMessage[]) ?? []
}

export async function createConversation(title = 'New conversation'): Promise<AiConversation | null> {
  const uid = await currentUserId()
  if (!uid) return null
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ user_id: uid, title })
    .select('*')
    .single()
  if (error) throw error
  return data as AiConversation
}

export async function saveAiMessage(conversationId: string, role: 'user' | 'assistant', content: string) {
  await supabase.from('ai_messages').insert({ conversation_id: conversationId, role, content })
}

export async function renameConversation(id: string, title: string) {
  await supabase.from('ai_conversations').update({ title }).eq('id', id)
}

export function fallbackTutorReply(question: string) {
  const q = question.toLowerCase()
  if (q.includes('quiz')) {
    return `Quick check on "${question}":\n1) What is the core idea in one sentence?\n2) Where would you use it in a real project?\n3) What mistake do beginners make?\nReply with your answers and I will score them.`
  }
  if (q.includes('project')) {
    return `Project idea for "${question}": build a small app that uses this concept in 3 screens (list, detail, form). Ship a GitHub link from the Projects page when you are done.`
  }
  if (q.includes('interview')) {
    return `Interview angle: explain "${question}" as if the interviewer asked "walk me through it". Cover definition, a real example, a trade-off, and a follow-up question you would ask.`
  }
  return `Here is a student-friendly take on "${question}": break it into (1) what it is, (2) why it matters in your course, (3) one example, (4) one practice step. Ask me to quiz you or give a project next. (Live GPT replies need an OpenAI key on the server — chats are saved either way.)`
}

export async function setMyPlan(plan: PlanId): Promise<{ error: string | null }> {
  const uid = await currentUserId()
  if (!uid) return { error: 'Not logged in' }
  const { error } = await supabase.from('profiles').update({ plan }).eq('id', uid)
  if (!error) await notify('Plan updated', `You are now on ${planLabel(plan)}.`, '/pricing')
  return { error: error?.message ?? null }
}

export async function notifyUser(userId: string, title: string, body?: string, href?: string) {
  await supabase.rpc('notify_user', {
    p_user: userId,
    p_title: title,
    p_body: body ?? null,
    p_href: href ?? null,
  })
}

export async function askAiTutor(
  history: { role: 'user' | 'assistant'; content: string }[],
  question: string,
): Promise<{ reply: string; source: 'openai' | 'fallback' }> {
  const { data, error } = await supabase.functions.invoke('ai-tutor', {
    body: { messages: [...history, { role: 'user', content: question }] },
  })
  if (error || !data?.reply) {
    return { reply: fallbackTutorReply(question), source: 'fallback' }
  }
  return {
    reply: data.reply as string,
    source: data.source === 'openai' ? 'openai' : 'fallback',
  }
}

export async function startCheckout(
  planId: PlanId,
): Promise<{ error: string | null; url?: string; local?: boolean }> {
  if (planId === 'free') {
    const { error } = await setMyPlan('free')
    return { error, local: true }
  }
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { planId, origin: window.location.origin },
  })
  if (error) return { error: error.message }
  if (data?.url) return { error: null, url: data.url as string }
  if (data?.mode === 'local') {
    const set = await setMyPlan(planId)
    return { error: set.error, local: true }
  }
  return { error: data?.error ?? 'Checkout failed' }
}

export async function getTutorCourses(): Promise<(CourseRow & { students: number })[]> {
  const uid = await currentUserId()
  if (!uid) return []
  const { data: courses, error } = await supabase.from('courses').select('*').eq('tutor_id', uid).order('created_at', { ascending: false })
  if (error) throw error
  const rows = (courses as CourseRow[]) ?? []
  const ids = rows.map(c => c.id)
  if (!ids.length) return []
  const { data: ens } = await supabase.from('enrollments').select('course_id').in('course_id', ids)
  const counts = new Map<string, number>()
  for (const e of (ens as { course_id: string }[]) ?? []) {
    counts.set(e.course_id, (counts.get(e.course_id) ?? 0) + 1)
  }
  return rows.map(c => ({ ...c, students: counts.get(c.id) ?? 0 }))
}

export async function getTutorStudents(): Promise<
  { progress: number; enrolled_at: string; last_lesson_id: string | null; student: ProfileLite | null; course: { id: string; title: string } | null }[]
> {
  const uid = await currentUserId()
  if (!uid) return []
  const mine = await getTutorCourses()
  const ids = mine.map(c => c.id)
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('enrollments')
    .select('progress, enrolled_at, last_lesson_id, course_id, student:profiles!student_id(id, full_name, avatar_url, headline), course:courses(id, title)')
    .in('course_id', ids)
    .order('enrolled_at', { ascending: false })
  if (error) throw error
  return (data as unknown as {
    progress: number
    enrolled_at: string
    last_lesson_id: string | null
    student: ProfileLite | null
    course: { id: string; title: string } | null
  }[]) ?? []
}

export async function getTutorBookings(): Promise<BookingRow[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('bookings')
    .select('*, listing:tutor_listings(*), student:profiles!student_id(id, full_name, avatar_url)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as BookingRow[]) ?? []
}

export async function setBookingStatus(
  id: string,
  status: BookingRow['status'],
  studentId?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  if (studentId) {
    const label = status === 'confirmed' ? 'Session confirmed' : status === 'cancelled' ? 'Session declined' : 'Session updated'
    await notifyUser(studentId, label, `Your booking is now ${status}.`, '/dashboard')
  }
  return { error: null }
}

export async function getReviewQueue(): Promise<
  (StudentProjectRow & { project: ProjectRow | null; student: ProfileLite | null })[]
> {
  const { data, error } = await supabase
    .from('student_projects')
    .select('*, project:projects(*), student:profiles!student_id(id, full_name, avatar_url)')
    .in('status', ['submitted', 'completed'])
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data as unknown as (StudentProjectRow & { project: ProjectRow | null; student: ProfileLite | null })[]) ?? []
}

export async function reviewProject(
  id: string,
  studentId: string,
  note: string,
  complete: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('student_projects')
    .update({
      status: complete ? 'completed' : 'submitted',
      review_note: note || null,
    })
    .eq('id', id)
  if (error) return { error: error.message }
  await notifyUser(
    studentId,
    complete ? 'Project approved' : 'Tutor left a review',
    note || 'Check your Projects page.',
    '/projects',
  )
  return { error: null }
}

export async function createCourse(input: {
  title: string
  description: string
  category: string
  level: string
  price_cents: number
}): Promise<{ error: string | null; id?: string }> {
  const uid = await currentUserId()
  if (!uid) return { error: 'Not logged in' }
  const { data, error } = await supabase
    .from('courses')
    .insert({
      tutor_id: uid,
      title: input.title,
      description: input.description,
      category: input.category,
      level: input.level,
      price_cents: input.price_cents,
      is_premium: input.price_cents > 0,
      published: false,
      rating: 5,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  const courseId = data.id as string
  const modules = ['Module 1: Foundations', 'Module 2: Core Skills', 'Module 3: Projects & Career']
  for (let i = 0; i < modules.length; i++) {
    const { data: mod } = await supabase
      .from('course_modules')
      .insert({ course_id: courseId, title: modules[i], sort_order: i + 1 })
      .select('id')
      .single()
    if (!mod) continue
    await supabase.from('course_lessons').insert([
      { module_id: mod.id, title: 'Welcome & overview', lesson_type: 'video', duration_min: 12, sort_order: 1, is_free: true },
      { module_id: mod.id, title: 'Core concepts explained', lesson_type: 'video', duration_min: 28, sort_order: 2, is_free: i === 0 },
      { module_id: mod.id, title: 'Hands-on practice', lesson_type: 'project', duration_min: 45, sort_order: 3, is_free: false },
      { module_id: mod.id, title: 'Knowledge check', lesson_type: 'quiz', duration_min: 15, sort_order: 4, is_free: false },
    ])
  }
  return { error: null, id: courseId }
}

export async function setCoursePublished(id: string, published: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from('courses').update({ published }).eq('id', id)
  return { error: error?.message ?? null }
}

export async function getAllProfiles(): Promise<ProfileLite[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, plan, created_at, headline')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ProfileLite[]) ?? []
}

export async function getAllCoursesAdmin(): Promise<CourseRow[]> {
  const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as CourseRow[]) ?? []
}

export async function setUserRole(userId: string, role: 'student' | 'tutor' | 'admin'): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  return { error: error?.message ?? null }
}

export async function getAdminStats() {
  const [profiles, courses, bookings, enrollments] = await Promise.all([
    getAllProfiles(),
    getAllCoursesAdmin(),
    supabase.from('bookings').select('id, status'),
    supabase.from('enrollments').select('id'),
  ])
  const students = profiles.filter(p => p.role === 'student').length
  const tutors = profiles.filter(p => p.role === 'tutor').length
  const pro = profiles.filter(p => p.plan === 'student_pro' || p.plan === 'career_pro').length
  const live = courses.filter(c => c.published).length
  const pending = courses.filter(c => !c.published).length
  const mrr = profiles.reduce((s, p) => s + (p.plan === 'career_pro' ? 59 : p.plan === 'student_pro' ? 29 : 0), 0)
  const bookRows = (bookings.data as { id: string; status: string }[]) ?? []
  return {
    students,
    tutors,
    users: profiles.length,
    live,
    pending,
    mrr,
    subscriptions: pro,
    enrollments: (enrollments.data ?? []).length,
    bookings: bookRows.length,
    confirmed: bookRows.filter(b => b.status === 'confirmed').length,
    profiles,
    courses,
  }
}

export async function getJobs(): Promise<JobRow[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as JobRow[]) ?? []
}

export function jobMatch(job: JobRow, skills: string[]) {
  const have = skills.map(s => s.toLowerCase())
  if (!have.length) return 55
  const hits = (job.tags ?? []).filter(t => have.some(s => t.toLowerCase().includes(s) || s.includes(t.toLowerCase())))
  return Math.min(99, 50 + hits.length * 14)
}

export async function getCourseReviews(courseId: string): Promise<CourseReview[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('course_reviews')
    .select('*, student:profiles!student_id(full_name, avatar_url)')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as CourseReview[]) ?? []
}

export async function submitCourseReview(
  courseId: string,
  rating: number,
  body: string,
): Promise<{ error: string | null }> {
  const uid = await currentUserId()
  if (!uid) return { error: 'Not logged in' }
  const { error } = await supabase.from('course_reviews').upsert(
    { course_id: courseId, student_id: uid, rating, body },
    { onConflict: 'course_id,student_id' },
  )
  return { error: error?.message ?? null }
}

export async function getLesson(lessonId: string): Promise<CourseLesson | null> {
  const { findStudioLesson } = await import('./tutorCourses')
  const studioLesson = findStudioLesson(lessonId)
  if (studioLesson) return studioLesson
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.from('course_lessons').select('*').eq('id', lessonId).maybeSingle()
  if (error) throw error
  return (data as CourseLesson) ?? null
}

export interface LiveClass {
  id: string
  tutor_id: string
  course_id: string | null
  title: string
  description: string | null
  status: 'scheduled' | 'live' | 'ended'
  starts_at: string
  ended_at: string | null
  meeting_url: string
  recording_url: string | null
  created_at: string
  tutor?: { full_name: string | null; avatar_url: string | null } | null
  course?: { id: string; title: string } | null
}

export function defaultMeetingUrl(classId: string) {
  return `https://meet.jit.si/LearnSyra${classId.replace(/-/g, '')}`
}

export function isJitsiUrl(url: string) {
  return url.includes('meet.jit.si')
}

export function toMediaEmbed(url: string | null): { kind: 'iframe' | 'video'; src: string } | null {
  if (!url) return null
  const u = url.trim()
  const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/))([\w-]+)/)
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` }
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return { kind: 'video', src: u }
  if (u.includes('youtube.com/embed') || u.includes('player.vimeo.com')) return { kind: 'iframe', src: u }
  return { kind: 'iframe', src: u }
}

const liveSelect = '*, tutor:profiles!tutor_id(full_name, avatar_url), course:courses(id, title)'

export async function getLiveClasses(): Promise<LiveClass[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('live_classes')
    .select(liveSelect)
    .order('starts_at', { ascending: false })
  if (error) throw error
  return (data as unknown as LiveClass[]) ?? []
}

export async function getLiveClass(id: string): Promise<LiveClass | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.from('live_classes').select(liveSelect).eq('id', id).maybeSingle()
  if (error) throw error
  return (data as unknown as LiveClass) ?? null
}

export async function getMyLiveAttendance(): Promise<string[]> {
  const uid = await currentUserId()
  if (!uid) return []
  const { data, error } = await supabase.from('live_class_attendance').select('class_id').eq('student_id', uid)
  if (error) throw error
  return ((data as { class_id: string }[]) ?? []).map(r => r.class_id)
}

export async function markLiveAttendance(classId: string): Promise<void> {
  const uid = await currentUserId()
  if (!uid) return
  await supabase.from('live_class_attendance').upsert(
    { class_id: classId, student_id: uid },
    { onConflict: 'class_id,student_id' },
  )
}

export async function createLiveClass(input: {
  title: string
  description?: string
  course_id?: string | null
  starts_at: string
  meeting_url?: string
  goLive?: boolean
}): Promise<{ error: string | null; id?: string }> {
  const uid = await currentUserId()
  if (!uid) return { error: 'Not logged in' }
  const id = crypto.randomUUID()
  const meeting_url = (input.meeting_url ?? '').trim() || defaultMeetingUrl(id)
  const { error } = await supabase.from('live_classes').insert({
    id,
    tutor_id: uid,
    course_id: input.course_id || null,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: input.goLive ? 'live' : 'scheduled',
    starts_at: input.starts_at,
    meeting_url,
  })
  if (error) return { error: error.message }
  if (input.goLive) await notifyLiveStudents(input.course_id || null, input.title.trim(), id)
  return { error: null, id }
}

export async function setLiveClassStatus(
  id: string,
  status: 'scheduled' | 'live' | 'ended',
  courseId?: string | null,
  title?: string,
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = { status }
  if (status === 'ended') patch.ended_at = new Date().toISOString()
  if (status === 'live') patch.ended_at = null
  const { error } = await supabase.from('live_classes').update(patch).eq('id', id)
  if (error) return { error: error.message }
  if (status === 'live') await notifyLiveStudents(courseId ?? null, title ?? 'Live class', id)
  return { error: null }
}

export async function setLiveRecording(id: string, recordingUrl: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('live_classes')
    .update({ recording_url: recordingUrl.trim() || null, status: 'ended' })
    .eq('id', id)
  return { error: error?.message ?? null }
}

async function notifyLiveStudents(courseId: string | null, title: string, classId: string) {
  if (!courseId) return
  const { data } = await supabase.from('enrollments').select('student_id').eq('course_id', courseId)
  for (const row of (data as { student_id: string }[]) ?? []) {
    await notifyUser(row.student_id, 'Live class started', `${title} is live now. Join from Live Classes.`, `/live/${classId}`)
  }
}
