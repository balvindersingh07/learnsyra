import { Link } from 'react-router-dom'
import BrandMark from '../BrandMark'

const FOOTER_LINKS = [
  { label: 'Blog', to: '/blog' },
  { label: 'Courses', to: '/courses' },
  { label: 'Tutors', to: '/tutors' },
  { label: 'Career', to: '/career' },
  { label: 'About', to: '/home' },
] as const

export default function PublicSiteFooter() {
  return (
    <footer
      className="border-t px-6 py-12"
      style={{
        borderColor: 'rgba(99,102,241,0.1)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(238,243,250,0.9) 100%)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-8">
          <div>
            <BrandMark size={44} withWordmark wordmarkClass="text-lg" />
            <p className="text-sm text-muted mt-3 max-w-xs leading-relaxed">
              AI-powered learning, expert tutors, real projects, and career preparation — one platform for
              students and educators.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-semibold text-muted hover:text-ink transition-colors"
                style={{ textDecoration: 'none', fontFamily: 'Plus Jakarta Sans,sans-serif' }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div
          className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted"
          style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}
        >
          <span>© {new Date().getFullYear()} LearnSyra. All rights reserved.</span>
          <span>Built for learners and tutors who want real outcomes.</span>
        </div>
      </div>
    </footer>
  )
}
