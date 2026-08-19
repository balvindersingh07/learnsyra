import type { Page } from '../App'
import { BlobField, Orb3D } from '../components/Soft3D'
import BrandMark from '../components/BrandMark'

interface Props {
  onNav: (p: Page) => void
}

function StatCard({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <div className="glass rounded-xl p-4 text-center card-hover">
      <div className="text-2xl mb-1">{icon}</div>
      <div
        className="text-2xl font-bold gradient-text mb-0.5"
        style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
      >
        {value}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  )
}

function FeatureCard({ icon, title, desc, color }: { icon: string; title: string; desc: string; color: string }) {
  return (
    <div
      className="glass rounded-2xl p-6 card-hover"
      style={{ borderColor: `${color}22`, borderWidth: 1 }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
        style={{ background: `${color}18` }}
      >
        {icon}
      </div>
      <h3
        className="text-ink font-bold text-lg mb-2"
        style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
      >
        {title}
      </h3>
      <p className="text-muted text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

function DashboardViz({ onNav }: { onNav: (p: Page) => void }) {
  return (
    <div className="relative flex items-center justify-center" style={{ minHeight: 520 }}>
      <BlobField />
      <div className="float absolute top-6 left-2 z-10">
        <Orb3D emoji="🧠" size={58} />
      </div>
      <div className="float2 absolute top-10 right-8 z-10">
        <Orb3D emoji="💻" size={50} />
      </div>
      <div className="float3 absolute bottom-16 -right-2 z-10">
        <Orb3D emoji="🎓" size={54} />
      </div>
      <div className="float absolute bottom-8 left-4 z-10">
        <Orb3D emoji="📚" size={48} />
      </div>
      {/* Floating elements */}
      <div
        className="float absolute -top-8 -left-8 glass rounded-2xl p-3 shadow-2xl"
        style={{ zIndex: 10, minWidth: 130 }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🧠</span>
          <span className="text-xs font-semibold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>AI Tutor</span>
        </div>
        <div className="text-xs text-muted">24/7 Available</div>
        <div className="flex gap-1 mt-1.5">
          <div className="h-1 flex-1 rounded bg-indigo-500" />
          <div className="h-1 flex-1 rounded bg-cyan-500" />
          <div className="h-1 flex-1 rounded bg-violet-500" />
        </div>
      </div>

      <div
        className="float2 absolute -top-4 right-0 glass rounded-2xl p-3 shadow-2xl"
        style={{ zIndex: 10 }}
      >
        <div className="text-xs text-muted mb-1">Career Readiness</div>
        <div className="text-2xl font-bold gradient-text" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>78%</div>
        <div className="progress-bar mt-1.5" style={{ width: 100 }}>
          <div className="progress-fill" style={{ width: '78%' }} />
        </div>
      </div>

      <div
        className="float3 absolute bottom-4 -left-10 glass rounded-2xl p-3 shadow-2xl"
        style={{ zIndex: 10 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🎓</span>
          <div>
            <div className="text-xs font-semibold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>Certificate Earned!</div>
            <div className="text-xs text-success">React Developer</div>
          </div>
        </div>
      </div>

      <div
        className="float absolute bottom-0 right-2 glass rounded-2xl p-3 shadow-2xl"
        style={{ zIndex: 10 }}
      >
        <div className="text-xs text-muted mb-1">This Week</div>
        <div className="flex items-end gap-1" style={{ height: 36 }}>
          {[40, 65, 45, 80, 60, 90, 75].map((h, i) => (
            <div
              key={i}
              className="w-3 rounded-sm"
              style={{
                height: `${h}%`,
                background: i === 5 ? 'linear-gradient(#6C5CE7,#22C7D6)' : 'rgba(108,92,231,0.3)',
              }}
            />
          ))}
        </div>
        <div className="text-xs text-muted mt-1">Learning hrs</div>
      </div>

      {/* Main dashboard card */}
      <div
        className="glass rounded-3xl shadow-2xl w-full max-w-md"
        style={{
          boxShadow: '0 30px 80px rgba(108,92,231,0.25), 0 0 0 1px rgba(255,255,255,0.1)',
          padding: '1.5rem',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop&auto=format"
              alt="Student avatar"
              className="w-9 h-9 rounded-full object-cover"
              style={{ border: '2px solid rgba(108,92,231,0.5)' }}
            />
            <div>
              <div className="text-sm font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                Alex Chen
              </div>
              <div className="text-xs text-muted">Level 12 · 🔥 14-day streak</div>
            </div>
          </div>
          <div className="badge badge-primary">PRO</div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { v: '247', l: 'XP Today', c: '#6C5CE7' },
            { v: '4.2h', l: 'This Week', c: '#22C7D6' },
            { v: '3', l: 'Courses', c: '#20C997' },
          ].map(s => (
            <div
              key={s.l}
              className="rounded-xl p-2 text-center"
              style={{ background: `${s.c}12`, border: `1px solid ${s.c}28` }}
            >
              <div className="text-base font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>{s.v}</div>
              <div className="text-xs text-muted">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Course in progress */}
        <div
          className="rounded-xl p-3 mb-3"
          style={{ background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.2)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'rgba(108,92,231,0.2)' }}
            >
              ⚡
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink truncate" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                Full Stack Web Dev
              </div>
              <div className="text-xs text-muted mb-1.5">Module 7 of 12 · React Hooks</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: '62%' }} />
              </div>
            </div>
            <div className="text-sm font-bold text-primary flex-shrink-0" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              62%
            </div>
          </div>
        </div>

        {/* AI assistant mini */}
        <div
          className="rounded-xl p-3 mb-3"
          style={{ background: 'rgba(34,199,214,0.08)', border: '1px solid rgba(34,199,214,0.2)' }}
        >
          <div className="flex items-start gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-0.5"
              style={{ background: 'linear-gradient(135deg,#6C5CE7,#22C7D6)' }}
            >
              ✨
            </div>
            <div>
              <div className="text-xs font-semibold text-accent mb-0.5" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                AI Tutor
              </div>
              <div className="text-xs text-muted leading-relaxed">
                "Great progress on useEffect! Ready to tackle custom hooks?"
              </div>
            </div>
          </div>
        </div>

        {/* Tutors */}
        <div>
          <div className="text-xs text-muted mb-2">Your Tutors</div>
          <div className="flex gap-2">
            {[
              { src: 'photo-1494790108755-2616b612b786', name: 'Sara K.', sub: 'React Expert' },
              { src: 'photo-1472099645785-5658abf4ff4e', name: 'Dr. James', sub: 'Data Science' },
              { src: 'photo-1438761681033-6461ffad8d80', name: 'Priya M.', sub: 'Career Coach' },
            ].map(t => (
              <div key={t.name} className="flex items-center gap-1.5">
                <img
                  src={`https://images.unsplash.com/${t.src}?w=32&h=32&fit=crop&auto=format`}
                  alt={t.name}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                  style={{ border: '1.5px solid rgba(108,92,231,0.5)' }}
                />
                <div>
                  <div className="text-xs font-semibold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                    {t.name}
                  </div>
                  <div className="text-xs text-muted">{t.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Landing({ onNav }: Props) {
  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="px-6 pt-20 pb-24 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <div className="badge badge-primary mb-6 text-sm py-1 px-3">
              🚀 AI-Powered Learning Platform
            </div>
            <h1
              className="text-5xl lg:text-6xl font-black text-ink leading-tight mb-6"
              style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
            >
              Learn Anything.{' '}
              <span className="gradient-text">Build Real Skills.</span>{' '}
              Prepare for Your Career.
            </h1>
            <p className="text-muted text-lg leading-relaxed mb-8" style={{ maxWidth: 480 }}>
              AI-powered learning + Expert tutors + Real projects + Career preparation.
            </p>
            <div className="flex flex-wrap gap-3 mb-10">
              <button className="btn-primary text-base px-6 py-3" onClick={() => onNav('dashboard')}>
                Start Learning →
              </button>
              <button className="btn-glass text-base px-6 py-3" onClick={() => onNav('tutors')}>
                Explore Tutors
              </button>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-muted">
              {['✅ Free to start', '✅ No credit card required', '✅ 50,000+ students'].map(t => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>

          {/* Right */}
          <DashboardViz onNav={onNav} />
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 pb-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard value="50K+" label="Active Students" icon="👩‍🎓" />
          <StatCard value="2,400+" label="Expert Tutors" icon="🧑‍🏫" />
          <StatCard value="800+" label="Courses" icon="📚" />
          <StatCard value="94%" label="Career Success Rate" icon="💼" />
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <div className="badge badge-accent mb-4">Everything You Need</div>
          <h2
            className="text-4xl font-black text-ink mb-4"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
          >
            One Platform.{' '}
            <span className="gradient-text">Infinite Possibilities.</span>
          </h2>
          <p className="text-muted text-lg max-w-xl mx-auto">
            From day one to your dream job — LearnSyra covers every step of your learning journey.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon="🤖"
            title="AI-Powered Tutor"
            desc="Get instant explanations, quizzes, code reviews, and personalized learning paths from our advanced AI tutor — available 24/7."
            color="#6C5CE7"
          />
          <FeatureCard
            icon="👨‍🏫"
            title="Expert Human Tutors"
            desc="Connect with 2,400+ vetted professionals for 1-on-1 sessions. Filter by subject, price, availability, and teaching style."
            color="#22C7D6"
          />
          <FeatureCard
            icon="📁"
            title="Real-World Projects"
            desc="Build portfolio-worthy projects with AI guidance and tutor support. Employers recognize our project certificates."
            color="#20C997"
          />
          <FeatureCard
            icon="🎯"
            title="Interview Preparation"
            desc="Practice with AI mock interviews, technical challenges, and behavioral questions tailored to your target companies."
            color="#8B5CF6"
          />
          <FeatureCard
            icon="📈"
            title="Career Roadmaps"
            desc="Follow structured learning paths from beginner to job-ready. Track your career readiness score as you progress."
            color="#f59e0b"
          />
          <FeatureCard
            icon="🏆"
            title="Recognized Certificates"
            desc="Earn industry-recognized certificates for courses and projects. Showcase them directly on LinkedIn with one click."
            color="#f43f5e"
          />
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20">
        <div
          className="max-w-5xl mx-auto rounded-3xl p-12"
          style={{
            background: 'linear-gradient(135deg, rgba(108,92,231,0.12), rgba(139,92,246,0.08))',
            border: '1px solid rgba(108,92,231,0.2)',
          }}
        >
          <div className="text-center mb-12">
            <h2
              className="text-4xl font-black text-ink mb-4"
              style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
            >
              Your Journey to{' '}
              <span className="gradient-text">Career Success</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', icon: '📚', title: 'Learn', desc: 'Choose courses and study with AI + human tutors' },
              { step: '02', icon: '🔨', title: 'Build', desc: 'Complete real projects and earn certificates' },
              { step: '03', icon: '🎯', title: 'Prepare', desc: 'Practice interviews and build your resume' },
              { step: '04', icon: '💼', title: 'Get Hired', desc: 'Land your dream job with our career network' },
            ].map((s, i) => (
              <div key={s.step} className="text-center relative">
                {i < 3 && (
                  <div
                    className="absolute top-8 left-3/4 w-1/2 hidden md:block"
                    style={{ height: 1, background: 'linear-gradient(90deg,rgba(108,92,231,0.5),transparent)' }}
                  />
                )}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                  style={{
                    background: 'rgba(108,92,231,0.15)',
                    border: '1px solid rgba(108,92,231,0.3)',
                  }}
                >
                  {s.icon}
                </div>
                <div
                  className="text-xs font-mono text-primary mb-1"
                  style={{ fontFamily: 'JetBrains Mono,monospace' }}
                >
                  STEP {s.step}
                </div>
                <div
                  className="text-ink font-bold text-lg mb-2"
                  style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
                >
                  {s.title}
                </div>
                <div className="text-muted text-sm">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2
            className="text-4xl font-black text-ink mb-4"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
          >
            Students Who{' '}
            <span className="gradient-text">Got Hired</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              name: 'Priya Sharma',
              role: 'Frontend Dev @ Google',
              img: 'photo-1488426862026-3ee34a7d66df',
              text: 'LearnSyra helped me go from zero to landing a Google offer in 8 months. The AI tutor explained concepts better than any YouTube video.',
              stars: 5,
            },
            {
              name: 'Marcus Johnson',
              role: 'Data Analyst @ Meta',
              img: 'photo-1506794778202-cad84cf45f1d',
              text: 'The combination of AI learning and human tutors is unmatched. My tutor Sara helped me land 3 interviews in one week.',
              stars: 5,
            },
            {
              name: 'Elena Vasquez',
              role: 'Product Manager @ Stripe',
              img: 'photo-1438761681033-6461ffad8d80',
              text: 'The career center and mock interviews gave me the confidence I needed. Got my PM role after just 6 months on the platform.',
              stars: 5,
            },
          ].map(t => (
            <div key={t.name} className="glass rounded-2xl p-6 card-hover">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <span key={i} className="star-filled text-sm">★</span>
                ))}
              </div>
              <p className="text-muted text-sm leading-relaxed mb-5">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <img
                  src={`https://images.unsplash.com/${t.img}?w=40&h=40&fit=crop&auto=format`}
                  alt={t.name}
                  className="w-10 h-10 rounded-full object-cover"
                  style={{ border: '2px solid rgba(108,92,231,0.4)' }}
                />
                <div>
                  <div
                    className="text-sm font-bold text-ink"
                    style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
                  >
                    {t.name}
                  </div>
                  <div className="text-xs text-muted">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center">
        <div
          className="max-w-3xl mx-auto rounded-3xl p-14"
          style={{
            background: 'linear-gradient(135deg, rgba(108,92,231,0.2), rgba(34,199,214,0.1))',
            border: '1px solid rgba(108,92,231,0.3)',
            boxShadow: '0 0 80px rgba(108,92,231,0.15)',
          }}
        >
          <div className="text-5xl mb-4">🚀</div>
          <h2
            className="text-4xl font-black text-ink mb-4"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
          >
            Ready to Start Your{' '}
            <span className="gradient-text">Learning Journey?</span>
          </h2>
          <p className="text-muted text-lg mb-8">
            Join 50,000+ students already learning on LearnSyra. Start free today.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button className="btn-primary text-lg px-8 py-4" onClick={() => onNav('dashboard')}>
              Start Learning for Free
            </button>
            <button className="btn-glass text-lg px-8 py-4" onClick={() => onNav('pricing')}>
              View Plans
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-6 py-10"
        style={{ borderTop: '1px solid rgba(99,102,241,0.12)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrandMark size={36} withWordmark />
          </div>
          <div className="text-muted text-sm">
            © 2026 LearnSyra · <span className="gradient-text font-medium">Learn. Build. Get Ready for the Future.</span>
          </div>
          <div className="flex gap-4 text-sm text-muted">
            <span className="cursor-pointer hover:text-ink transition-colors">Privacy</span>
            <span className="cursor-pointer hover:text-ink transition-colors">Terms</span>
            <span className="cursor-pointer hover:text-ink transition-colors">Contact</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
