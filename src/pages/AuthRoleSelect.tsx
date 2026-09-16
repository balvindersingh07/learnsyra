import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { postLoginPath } from '../lib/roleAccess'
import { authLoginPath } from '../lib/authFlow'
import { BLOG_POSTS, blogPostPath } from '../lib/blogPosts'
import { BlobField, Orb3D } from '../components/Soft3D'
import BrandMark from '../components/BrandMark'
import RoleSelectCards from '../components/landing/RoleSelectCards'
import PublicSiteFooter from '../components/landing/PublicSiteFooter'

const WHY_ITEMS = [
  {
    icon: '🤖',
    title: 'AI-powered learning',
    desc: 'Practice anytime with an adaptive AI tutor that explains concepts, drills weak spots, and prepares you between live sessions.',
    color: '#6C5CE7',
  },
  {
    icon: '👨‍🏫',
    title: 'Expert human tutors',
    desc: 'Book practitioners who review your work, run live sessions, and help you build judgment beyond what videos alone can teach.',
    color: '#4F8CFF',
  },
  {
    icon: '🛠️',
    title: 'Real-world projects',
    desc: 'Turn skills into portfolio proof with guided project workspaces, milestones, and optional tutor feedback on deliverables.',
    color: '#22C7D6',
  },
  {
    icon: '🎯',
    title: 'Interview preparation',
    desc: 'Mock interviews, structured feedback, and role-specific practice so you communicate clearly under pressure.',
    color: '#8B5CF6',
  },
  {
    icon: '💼',
    title: 'Job readiness',
    desc: 'Resume builder, career center tools, and job search support that connect learning to hiring outcomes.',
    color: '#20C997',
  },
]

const JOURNEY_STEPS = [
  { step: '01', label: 'Learn', desc: 'Structured courses and AI-guided paths build your foundation.', icon: '📚' },
  { step: '02', label: 'Practice', desc: 'Drills, quizzes, and AI sessions reinforce what you study.', icon: '🧠' },
  { step: '03', label: 'Build', desc: 'Ship projects that demonstrate real skills to employers.', icon: '💻' },
  { step: '04', label: 'Prepare', desc: 'Resume, mocks, and tutor coaching sharpen your story.', icon: '📝' },
  { step: '05', label: 'Get Hired', desc: 'Apply with evidence — projects, practice, and confidence.', icon: '🚀' },
]

const STUDENT_FEATURES = [
  { icon: '📖', title: 'Courses', desc: 'Browse structured learning paths across in-demand skills.' },
  { icon: '🤖', title: 'AI Tutor', desc: 'Get explanations, practice, and revision on your schedule.' },
  { icon: '🗺️', title: 'Skill roadmap', desc: 'Follow a clear progression from fundamentals to job-ready depth.' },
  { icon: '🛠️', title: 'Projects', desc: 'Build portfolio work in guided workspaces with real briefs.' },
  { icon: '🎤', title: 'Interview studio', desc: 'Practice behavioral and technical questions with feedback.' },
  { icon: '📄', title: 'Resume builder', desc: 'Craft a resume aligned to your target role and projects.' },
  { icon: '💼', title: 'Career center', desc: 'Interview prep, job search, and career tools in one place.' },
]

const TUTOR_FEATURES = [
  { icon: '🧑‍🏫', title: 'Teach your expertise', desc: 'Share knowledge in your domain with students who are actively building skills.' },
  { icon: '📅', title: 'Live sessions', desc: 'Host 1-on-1 and group sessions with scheduling built into the platform.' },
  { icon: '✅', title: 'Project reviews', desc: 'Give structured feedback on student deliverables and portfolios.' },
  { icon: '🤝', title: 'Student support', desc: 'Coach learners through roadblocks, career questions, and interview prep.' },
  { icon: '💰', title: 'Earning opportunities', desc: 'Monetize sessions, courses, and reviews through the tutor marketplace.' },
]

const FEATURED_POSTS = BLOG_POSTS.slice(0, 4)

function SectionHeading({
  badge,
  title,
  subtitle,
}: {
  badge: string
  title: string
  subtitle: string
}) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
      <div className="badge badge-primary mb-4">{badge}</div>
      <h2
        className="text-3xl sm:text-4xl font-black text-ink mb-3"
        style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
      >
        {title}
      </h2>
      <p className="text-muted text-base sm:text-lg leading-relaxed">{subtitle}</p>
    </div>
  )
}

export default function AuthRoleSelect() {
  const { session, profile, loading: authLoading, isEmailVerified } = useAuth()

  if (session && (authLoading || !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="glass rounded-2xl px-6 py-4 text-muted">Loading…</div>
      </div>
    )
  }

  if (session && profile) {
    if (import.meta.env.PROD && !isEmailVerified) {
      return <Navigate to="/verify-email" replace />
    }
    return <Navigate to={postLoginPath('/dashboard', profile.role)} replace />
  }

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{
        background: 'linear-gradient(180deg, #FAFBFE 0%, #F7F9FC 35%, #EEF3FA 100%)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Top bar */}
      <header
        className="sticky top-0 z-50 px-6 py-3"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(99,102,241,0.1)',
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <BrandMark size={40} withWordmark wordmarkClass="text-lg hidden sm:block" />
          <BrandMark size={40} className="sm:hidden" />
          <nav className="hidden md:flex items-center gap-6">
            {[
              { label: 'Courses', to: '/courses' },
              { label: 'Tutors', to: '/tutors' },
              { label: 'Career', to: '/career' },
              { label: 'Blog', to: '/blog' },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm font-semibold text-muted hover:text-ink transition-colors"
                style={{ textDecoration: 'none', fontFamily: 'Plus Jakarta Sans,sans-serif' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <a href="#get-started" className="btn-primary text-sm px-4 py-2 shrink-0">
            Get Started
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-6 pt-12 pb-16 sm:pt-16 sm:pb-20 overflow-hidden">
        <BlobField />
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div>
              <div className="badge badge-accent mb-5">AI-Powered Learning Platform</div>
              <h1
                className="text-4xl sm:text-5xl lg:text-[3.25rem] font-black text-ink leading-[1.08] mb-5"
                style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
              >
                Learn. Build.{' '}
                <span className="gradient-text">Get Ready for the Future.</span>
              </h1>
              <p className="text-muted text-base sm:text-lg leading-relaxed mb-6 max-w-xl">
                LearnSyra brings together AI-powered learning, expert human tutors, real-world projects, and
                career preparation — so students gain job-ready skills and tutors grow meaningful teaching
                businesses.
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-8">
                <Orb3D emoji="🎓" size={44} />
                <Orb3D emoji="🧠" size={40} className="float" />
                <Orb3D emoji="💼" size={36} className="float2" />
              </div>
              <p className="text-sm font-semibold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                Choose your profile to continue
              </p>
            </div>

            <div id="get-started" className="scroll-mt-24">
              <RoleSelectCards />
            </div>
          </div>
        </div>
      </section>

      {/* Why LearnSyra */}
      <section className="px-6 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            badge="Why LearnSyra?"
            title="One platform for learning and career growth"
            subtitle="Everything you need to go from curiosity to confidence — without juggling disconnected tools."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {WHY_ITEMS.map(item => (
              <div
                key={item.title}
                className="glass rounded-2xl p-6 card-hover"
                style={{ border: '1px solid rgba(255,255,255,0.55)' }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                  style={{ background: `${item.color}18` }}
                >
                  {item.icon}
                </div>
                <h3
                  className="text-lg font-bold text-ink mb-2"
                  style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
                >
                  {item.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        className="px-6 py-16 sm:py-20"
        style={{ background: 'linear-gradient(180deg, rgba(237,232,255,0.35) 0%, rgba(255,255,255,0) 100%)' }}
      >
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            badge="How LearnSyra Works"
            title="A clear path from first lesson to first offer"
            subtitle="Learn → Practice → Build → Prepare → Get Hired — designed as one connected journey."
          />
          <div className="relative">
            <div
              className="hidden lg:block absolute top-12 left-[10%] right-[10%] h-0.5"
              style={{ background: 'linear-gradient(90deg, #6C5CE7, #4F8CFF, #22C7D6, #8B5CF6, #20C997)' }}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {JOURNEY_STEPS.map((item, i) => (
                <div
                  key={item.label}
                  className="glass rounded-2xl p-5 card-hover text-center relative"
                  style={{ border: '1px solid rgba(255,255,255,0.55)' }}
                >
                  <div
                    className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-black text-white"
                    style={{
                      background: 'linear-gradient(135deg, #6C5CE7, #4F8CFF)',
                      boxShadow: '0 6px 16px rgba(108,92,231,0.25)',
                    }}
                  >
                    {item.icon}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                    Step {item.step}
                  </div>
                  <h3
                    className="text-base font-black text-ink mb-2"
                    style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
                  >
                    {item.label}
                  </h3>
                  <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
                  {i < JOURNEY_STEPS.length - 1 && (
                    <span className="lg:hidden text-muted text-lg mt-3 block">↓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Student experience */}
      <section className="px-6 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="badge badge-primary mb-4">For Students</div>
              <h2
                className="text-3xl sm:text-4xl font-black text-ink mb-4"
                style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
              >
                Everything you need to{' '}
                <span className="gradient-text">learn and get hired</span>
              </h2>
              <p className="text-muted leading-relaxed mb-6">
                From your first course to your final interview, LearnSyra keeps learning, building, and career
                prep in one workspace — with AI and human support at every step.
              </p>
              <Link to={authLoginPath('student')} className="btn-primary inline-flex px-6 py-3" style={{ textDecoration: 'none' }}>
                Start as Student →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {STUDENT_FEATURES.map(f => (
                <div
                  key={f.title}
                  className="glass rounded-xl p-4 card-hover"
                  style={{ border: '1px solid rgba(255,255,255,0.5)' }}
                >
                  <div className="text-xl mb-2">{f.icon}</div>
                  <h3 className="text-sm font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                    {f.title}
                  </h3>
                  <p className="text-xs text-muted leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Tutor experience */}
      <section
        className="px-6 py-16 sm:py-20"
        style={{ background: 'linear-gradient(180deg, rgba(79,140,255,0.06) 0%, rgba(255,255,255,0) 100%)' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="order-2 lg:order-1 grid sm:grid-cols-2 gap-3">
              {TUTOR_FEATURES.map(f => (
                <div
                  key={f.title}
                  className="glass rounded-xl p-4 card-hover"
                  style={{ border: '1px solid rgba(255,255,255,0.5)' }}
                >
                  <div className="text-xl mb-2">{f.icon}</div>
                  <h3 className="text-sm font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                    {f.title}
                  </h3>
                  <p className="text-xs text-muted leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
            <div className="order-1 lg:order-2">
              <div className="badge badge-accent mb-4">For Tutors</div>
              <h2
                className="text-3xl sm:text-4xl font-black text-ink mb-4"
                style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
              >
                Teach, support students,{' '}
                <span className="gradient-text">and grow your practice</span>
              </h2>
              <p className="text-muted leading-relaxed mb-6">
                LearnSyra gives educators scheduling, course tools, project review workflows, and marketplace
                visibility — so you can focus on teaching while the platform handles the rest.
              </p>
              <Link to={authLoginPath('tutor')} className="btn-glass inline-flex px-6 py-3 font-semibold" style={{ textDecoration: 'none' }}>
                Become a Tutor →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Blog insights */}
      <section className="px-6 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            badge="Insights"
            title="Featured from the LearnSyra Blog"
            subtitle="Practical guides on AI learning, projects, interviews, and career readiness."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
            {FEATURED_POSTS.map(post => (
              <Link
                key={post.slug}
                to={blogPostPath(post.slug)}
                className="glass rounded-2xl p-5 card-hover flex flex-col h-full group"
                style={{ textDecoration: 'none', border: '1px solid rgba(255,255,255,0.55)' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3"
                  style={{ background: 'rgba(108,92,231,0.1)' }}
                >
                  {post.coverEmoji}
                </div>
                <span className="badge badge-primary text-[10px] mb-2 w-fit">{post.category}</span>
                <h3
                  className="text-sm font-black text-ink mb-2 leading-snug line-clamp-2"
                  style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
                >
                  {post.title}
                </h3>
                <p className="text-xs text-muted leading-relaxed mb-4 flex-1 line-clamp-3">{post.excerpt}</p>
                <span
                  className="text-xs font-bold inline-flex items-center gap-1"
                  style={{ color: '#6C5CE7', fontFamily: 'Plus Jakarta Sans,sans-serif' }}
                >
                  Read article
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              </Link>
            ))}
          </div>
          <div className="text-center">
            <Link
              to="/blog"
              className="text-sm font-bold inline-flex items-center gap-1"
              style={{ color: '#6C5CE7', textDecoration: 'none', fontFamily: 'Plus Jakarta Sans,sans-serif' }}
            >
              View all insights
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="px-6 py-16 sm:py-20"
        style={{ background: 'linear-gradient(165deg, #EEF3FA 0%, #EDE8FF 55%, #F7F9FC 100%)' }}
      >
        <div className="max-w-3xl mx-auto text-center relative">
          <BlobField />
          <div className="relative z-10">
            <h2
              className="text-3xl sm:text-4xl font-black text-ink mb-4"
              style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
            >
              Your future starts with the right skills.
            </h2>
            <p className="text-muted mb-8 max-w-lg mx-auto">
              Pick how you want to use LearnSyra. Your profile type is set once and keeps your experience
              tailored from day one.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to={authLoginPath('student')} className="btn-primary px-8 py-3.5 text-base" style={{ textDecoration: 'none' }}>
                Start as Student
              </Link>
              <Link
                to={authLoginPath('tutor')}
                className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold rounded-xl"
                style={{
                  textDecoration: 'none',
                  border: '1.5px solid #6C5CE7',
                  color: '#6C5CE7',
                  fontFamily: 'Plus Jakarta Sans,sans-serif',
                  background: 'rgba(255,255,255,0.7)',
                }}
              >
                Become a Tutor
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicSiteFooter />
    </div>
  )
}
