import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import AdminNav from './components/AdminNav'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLogin from './pages/AdminLogin'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import NotFound from './pages/NotFound'
import AdminDashboard from './pages/AdminDashboard'
import AdminUsers from './pages/AdminUsers'
import AdminUserDetail from './pages/AdminUserDetail'
import AdminTutors from './pages/AdminTutors'
import AdminTutorDetail from './pages/AdminTutorDetail'
import AdminVerification from './pages/AdminVerification'
import AdminVerificationDetail from './pages/AdminVerificationDetail'
import AdminCourses from './pages/AdminCourses'
import AdminCourseDetail from './pages/AdminCourseDetail'
import AdminProjects from './pages/AdminProjects'
import AdminProjectDetail from './pages/AdminProjectDetail'
import AdminSessions from './pages/AdminSessions'
import AdminSessionDetail from './pages/AdminSessionDetail'
import AdminPayments from './pages/AdminPayments'
import AdminPaymentDetail from './pages/AdminPaymentDetail'
import AdminReports from './pages/AdminReports'
import AdminReportDetail from './pages/AdminReportDetail'
import AdminAnalytics from './pages/AdminAnalytics'
import AdminSettings from './pages/AdminSettings'
import AdminAudit from './pages/AdminAudit'
import AdminAuditDetail from './pages/AdminAuditDetail'
import AdminProfile from './pages/AdminProfile'
import { useAuth } from './context/AuthContext'
import { authAdminLoginPath } from './lib/authFlow'
import { ADMIN_HOME } from './lib/roleAccess'

function AdminApp({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute roles={['admin']}>{children}</ProtectedRoute>
}

function AdminEntryRoute() {
  const { session, profile, loading } = useAuth()

  if (loading || (session && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="glass rounded-2xl px-6 py-4 text-muted">Loading…</div>
      </div>
    )
  }

  if (session && profile?.role === 'admin') {
    return <Navigate to={ADMIN_HOME} replace />
  }

  return <AdminLogin />
}

export default function AppAdmin() {
  const location = useLocation()
  const adminLoginPath = authAdminLoginPath()
  const hideNav =
    location.pathname === '/' ||
    location.pathname === adminLoginPath ||
    location.pathname === '/reset-password' ||
    location.pathname === '/verify-email'

  return (
    <div className="min-h-screen mesh-bg" style={{ fontFamily: 'Inter, sans-serif' }}>
      {!hideNav && <AdminNav />}
      <main>
        <Routes>
          <Route path="/" element={<AdminEntryRoute />} />
          <Route path={adminLoginPath} element={<AdminLogin />} />
          <Route path="/login" element={<Navigate to={adminLoginPath} replace />} />
          <Route path="/login/:authRole" element={<Navigate to={adminLoginPath} replace />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/admin" element={<AdminApp><AdminDashboard /></AdminApp>} />
          <Route path="/admin/users/:id" element={<AdminApp><AdminUserDetail /></AdminApp>} />
          <Route path="/admin/users" element={<AdminApp><AdminUsers /></AdminApp>} />
          <Route path="/admin/tutors/:id" element={<AdminApp><AdminTutorDetail /></AdminApp>} />
          <Route path="/admin/tutors" element={<AdminApp><AdminTutors /></AdminApp>} />
          <Route path="/admin/courses/:id" element={<AdminApp><AdminCourseDetail /></AdminApp>} />
          <Route path="/admin/courses" element={<AdminApp><AdminCourses /></AdminApp>} />
          <Route path="/admin/projects/:id" element={<AdminApp><AdminProjectDetail /></AdminApp>} />
          <Route path="/admin/projects" element={<AdminApp><AdminProjects /></AdminApp>} />
          <Route path="/admin/sessions/:id" element={<AdminApp><AdminSessionDetail /></AdminApp>} />
          <Route path="/admin/sessions" element={<AdminApp><AdminSessions /></AdminApp>} />
          <Route path="/admin/payments/:id" element={<AdminApp><AdminPaymentDetail /></AdminApp>} />
          <Route path="/admin/payments" element={<AdminApp><AdminPayments /></AdminApp>} />
          <Route path="/admin/reports/:id" element={<AdminApp><AdminReportDetail /></AdminApp>} />
          <Route path="/admin/reports" element={<AdminApp><AdminReports /></AdminApp>} />
          <Route path="/admin/analytics" element={<AdminApp><AdminAnalytics /></AdminApp>} />
          <Route path="/admin/verification/:id" element={<AdminApp><AdminVerificationDetail /></AdminApp>} />
          <Route path="/admin/verification" element={<AdminApp><AdminVerification /></AdminApp>} />
          <Route path="/admin/settings" element={<AdminApp><AdminSettings /></AdminApp>} />
          <Route path="/admin/audit/:id" element={<AdminApp><AdminAuditDetail /></AdminApp>} />
          <Route path="/admin/audit" element={<AdminApp><AdminAudit /></AdminApp>} />
          <Route path="/admin/profile" element={<AdminApp><AdminProfile /></AdminApp>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}
