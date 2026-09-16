import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import Nav from './components/Nav'
import AskLearnSyra from './components/AskLearnSyra'
import ProtectedRoute from './components/ProtectedRoute'
import TutorBounce from './components/TutorBounce'
import { useNav } from './lib/useNav'
import AuthRoleSelect from './pages/AuthRoleSelect'
import Intro from './pages/Intro'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import AILearning from './pages/AILearning'
import TutorMarketplace from './pages/TutorMarketplace'
import TutorProfile from './pages/TutorProfile'
import TutorBook from './pages/TutorBook'
import SessionDetail from './pages/SessionDetail'
import Courses from './pages/Courses'
import CourseDetail from './pages/CourseDetail'
import LessonPlayer from './pages/LessonPlayer'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import ProjectWorkspace from './pages/ProjectWorkspace'
import CareerCenter from './pages/CareerCenter'
import CareerInterview from './pages/CareerInterview'
import CareerResume from './pages/CareerResume'
import CareerJobs from './pages/CareerJobs'
import CareerJobDetail from './pages/CareerJobDetail'
import Pricing from './pages/Pricing'
import TutorDashboard from './pages/TutorDashboard'
import TutorAiTeaching from './pages/TutorAiTeaching'
import TutorEarnings from './pages/TutorEarnings'
import TutorPayoutSettings from './pages/TutorPayoutSettings'
import TutorAnalytics from './pages/TutorAnalytics'
import TutorSettings from './pages/TutorSettings'
import TutorAccount from './pages/TutorAccount'
import TutorStudents from './pages/TutorStudents'
import TutorStudentDetail from './pages/TutorStudentDetail'
import TutorSessions from './pages/TutorSessions'
import TutorSessionDetail from './pages/TutorSessionDetail'
import TutorCourses from './pages/TutorCourses'
import TutorCourseStudio from './pages/TutorCourseStudio'
import TutorProjects from './pages/TutorProjects'
import TutorProjectReview from './pages/TutorProjectReview'
import PublicAdminRedirect from './components/PublicAdminRedirect'
import NotFound from './pages/NotFound'
import Signup from './pages/Signup'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Profile from './pages/Profile'
import Notifications from './pages/Notifications'
import LiveClasses from './pages/LiveClasses'
import LiveRoom from './pages/LiveRoom'

function LandingRoute() {
  const nav = useNav()
  return <Landing onNav={nav} />
}
function DashboardRoute() {
  const nav = useNav()
  return <Dashboard onNav={nav} />
}
function CoursesRoute() {
  const nav = useNav()
  return <Courses onNav={nav} />
}
function CourseDetailRoute() {
  const nav = useNav()
  return <CourseDetail onNav={nav} />
}
function PricingRoute() {
  const nav = useNav()
  return <Pricing onNav={nav} />
}

function StudentApp({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute roles={['student']}>{children}</ProtectedRoute>
}

function TutorApp({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute roles={['tutor']}>{children}</ProtectedRoute>
}

export default function AppPublic() {
  const location = useLocation()
  const hideNav =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname.startsWith('/login/') ||
    location.pathname === '/signup' ||
    location.pathname === '/reset-password' ||
    location.pathname === '/verify-email'

  return (
    <div className="min-h-screen mesh-bg" style={{ fontFamily: 'Inter, sans-serif' }}>
      {!hideNav && <Nav />}
      <AskLearnSyra />
      <main>
        <Routes>
          <Route path="/" element={<AuthRoleSelect />} />
          <Route path="/login" element={<Intro />} />
          <Route path="/login/:authRole" element={<Intro />} />
          <Route path="/home" element={<LandingRoute />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/courses" element={<TutorBounce to="/tutor/courses"><CoursesRoute /></TutorBounce>} />
          <Route path="/courses/:id" element={<TutorBounce to="/tutor/courses"><CourseDetailRoute /></TutorBounce>} />
          <Route path="/courses/:id/learn/:lessonId" element={<TutorBounce to="/tutor/courses"><LessonPlayer /></TutorBounce>} />
          <Route path="/course-detail" element={<Navigate to="/courses" replace />} />
          <Route path="/tutors" element={<TutorBounce><TutorMarketplace /></TutorBounce>} />
          <Route path="/tutors/:id" element={<TutorProfile />} />
          <Route path="/tutors/:id/book" element={<TutorBook />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/projects" element={<TutorBounce to="/tutor/projects"><Projects /></TutorBounce>} />
          <Route path="/projects/:id" element={<TutorBounce to="/tutor/projects"><ProjectDetail /></TutorBounce>} />
          <Route path="/projects/:id/workspace" element={<TutorBounce to="/tutor/projects"><ProjectWorkspace /></TutorBounce>} />
          <Route path="/pricing" element={<TutorBounce to="/tutor/profile#pricing"><PricingRoute /></TutorBounce>} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route
            path="/dashboard"
            element={
              <StudentApp>
                <DashboardRoute />
              </StudentApp>
            }
          />
          <Route
            path="/ai-learning"
            element={
              <StudentApp>
                <AILearning />
              </StudentApp>
            }
          />
          <Route
            path="/career"
            element={
              <StudentApp>
                <CareerCenter />
              </StudentApp>
            }
          />
          <Route
            path="/career/interview"
            element={
              <StudentApp>
                <CareerInterview />
              </StudentApp>
            }
          />
          <Route
            path="/career/resume"
            element={
              <StudentApp>
                <CareerResume />
              </StudentApp>
            }
          />
          <Route
            path="/career/jobs"
            element={
              <StudentApp>
                <CareerJobs />
              </StudentApp>
            }
          />
          <Route
            path="/career/jobs/:id"
            element={
              <StudentApp>
                <CareerJobDetail />
              </StudentApp>
            }
          />
          <Route
            path="/profile"
            element={
              <StudentApp>
                <Profile />
              </StudentApp>
            }
          />
          <Route
            path="/live"
            element={
              <StudentApp>
                <LiveClasses />
              </StudentApp>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/live/:id"
            element={
              <ProtectedRoute>
                <LiveRoom />
              </ProtectedRoute>
            }
          />
          <Route path="/tutor" element={<TutorApp><TutorDashboard /></TutorApp>} />
          <Route path="/tutor/dashboard" element={<Navigate to="/tutor" replace />} />
          <Route path="/tutor/students" element={<TutorApp><TutorStudents /></TutorApp>} />
          <Route path="/tutor/students/:id" element={<TutorApp><TutorStudentDetail /></TutorApp>} />
          <Route path="/tutor/courses" element={<TutorApp><TutorCourses /></TutorApp>} />
          <Route path="/tutor/courses/new" element={<TutorApp><TutorCourseStudio /></TutorApp>} />
          <Route path="/tutor/courses/:id/preview" element={<TutorApp><CourseDetailRoute /></TutorApp>} />
          <Route path="/tutor/courses/:id" element={<TutorApp><TutorCourseStudio /></TutorApp>} />
          <Route path="/tutor/projects" element={<TutorApp><TutorProjects /></TutorApp>} />
          <Route path="/tutor/projects/workspace/:id" element={<TutorApp><ProjectWorkspace /></TutorApp>} />
          <Route path="/tutor/projects/:id" element={<TutorApp><TutorProjectReview /></TutorApp>} />
          <Route path="/tutor/sessions" element={<TutorApp><TutorSessions /></TutorApp>} />
          <Route path="/tutor/sessions/:id" element={<TutorApp><TutorSessionDetail /></TutorApp>} />
          <Route path="/tutor/live" element={<TutorApp><TutorDashboard /></TutorApp>} />
          <Route path="/tutor/ai" element={<TutorApp><TutorAiTeaching /></TutorApp>} />
          <Route path="/tutor/earnings" element={<TutorApp><TutorEarnings /></TutorApp>} />
          <Route path="/tutor/payout-settings" element={<TutorApp><TutorPayoutSettings /></TutorApp>} />
          <Route path="/tutor/analytics" element={<TutorApp><TutorAnalytics /></TutorApp>} />
          <Route path="/tutor/settings" element={<TutorApp><TutorSettings /></TutorApp>} />
          <Route path="/tutor/profile" element={<TutorApp><TutorAccount /></TutorApp>} />
          <Route path="/admin/*" element={<PublicAdminRedirect />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}
