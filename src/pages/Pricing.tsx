import type { Page } from '../App'
import { useAuth } from '../context/AuthContext'
import { startCheckout, type PlanId } from '../lib/api'
import { formatInr, INDIA_PAID_PLANS } from '../lib/paymentPlans'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

interface Props {
  onNav: (p: Page) => void
}

const plans: {
  name: string
  planId: PlanId
  price: number
  period: string
  desc: string
  color: string
  gradient: string
  features: string[]
  cta: string
  popular: boolean
}[] = [
  {
    name: 'Free',
    planId: 'free',
    price: 0,
    period: 'forever',
    desc: 'Start your learning journey with no commitment.',
    color: '#667085',
    gradient: 'rgba(100,116,139,0.15)',
    features: [
      '✅ Basic AI Tutor (10 questions/day)',
      '✅ Access to 50+ free courses',
      '✅ 1 active project',
      '✅ Community forum access',
      '✅ Basic skill assessments',
      '❌ Premium courses',
      '❌ Interview preparation',
      '❌ Tutor sessions',
      '❌ Resume builder',
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    name: 'Student Pro',
    planId: 'student_pro',
    price: 29,
    period: 'month',
    desc: 'Everything you need to learn faster and get career-ready.',
    color: '#6C5CE7',
    gradient: 'rgba(108,92,231,0.15)',
    features: [
      '✅ Unlimited AI Tutor access',
      '✅ 800+ premium courses',
      '✅ Unlimited projects + badges',
      '✅ Interview preparation',
      '✅ AI resume builder',
      '✅ Priority support',
      '✅ 30% discount on tutor sessions',
      '✅ Career readiness tracker',
      '✅ LinkedIn certificate sharing',
    ],
    cta: 'Upgrade Now',
    popular: true,
  },
  {
    name: 'Career Pro',
    planId: 'career_pro',
    price: 59,
    period: 'month',
    desc: 'The complete package for serious career changers and job seekers.',
    color: '#22C7D6',
    gradient: 'rgba(34,199,214,0.15)',
    features: [
      '✅ Everything in Student Pro',
      '✅ Advanced projects with mentorship',
      '✅ 2 live mock interviews/month',
      '✅ Advanced resume tools + review',
      '✅ Job application tracker',
      '✅ Direct recruiter connections',
      '✅ Salary negotiation prep',
      '✅ 1 tutor session credit/month',
      '✅ Priority job matching',
    ],
    cta: 'Upgrade Now',
    popular: false,
  },
]

export default function Pricing({ onNav }: Props) {
  const { session, profile, reloadProfile } = useAuth()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [msgErr, setMsgErr] = useState(false)
  const [paymentsUnavailable, setPaymentsUnavailable] = useState(false)

  useEffect(() => {
    if (params.get('paid') === '1') {
      reloadProfile()
      setMsgErr(false)
      setMsg('If you completed checkout, your subscription activates after verification. Refresh in a moment.')
    }
    if (params.get('canceled') === '1') {
      setMsgErr(false)
      setMsg('Checkout canceled.')
    }
  }, [params, reloadProfile])

  const choose = async (planId: PlanId) => {
    if (!session) {
      onNav('login')
      return
    }
    if (planId !== 'free' && paymentsUnavailable) {
      setMsgErr(true)
      setMsg('Payments unavailable / Coming soon.')
      return
    }
    setBusy(planId)
    const result = await startCheckout(planId)
    setBusy(null)
    if (result.unavailable) setPaymentsUnavailable(true)
    if (result.error) {
      setMsgErr(true)
      setMsg(result.error)
      return
    }
    if ('url' in result && result.url) {
      window.location.href = result.url
      return
    }
    if (result.verified) {
      await reloadProfile()
      setMsgErr(false)
      setMsg('Subscription verified. Your plan is updating now.')
      return
    }
    if (result.pending === false) {
      setMsgErr(false)
      setMsg('Payment canceled.')
      return
    }
    if (result.pending) {
      setMsgErr(false)
      setMsg('Subscription started. Your plan updates after server verification.')
      await reloadProfile()
      return
    }
    if (planId === 'free') {
      await reloadProfile()
      setMsgErr(false)
      setMsg(
        profile?.plan && profile.plan !== 'free'
          ? 'Paid plans change only after an active subscription is verified. Free access stays available.'
          : 'You are on the free plan.',
      )
    }
  }
  return (
    <div className="pt-20 px-6 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-14">
        <div className="badge badge-primary mb-4 text-sm">Affordable & Transparent Pricing</div>
        <h1
          className="text-5xl font-black text-ink mb-4"
          style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
        >
          Invest in Your <span className="gradient-text">Future</span>
        </h1>
        <p className="text-muted text-xl max-w-xl mx-auto">
          Start free. Upgrade when you need more. No long-term contracts, cancel anytime.
        </p>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-6 mb-20">
        {plans.map(p => (
          <div
            key={p.name}
            className="rounded-2xl p-6 flex flex-col relative"
            style={{
              background: p.popular ? 'rgba(108,92,231,0.12)' : 'rgba(255,255,255,0.75)',
              border: p.popular ? '2px solid rgba(108,92,231,0.5)' : '1px solid rgba(99,102,241,0.12)',
              boxShadow: p.popular ? '0 0 60px rgba(108,92,231,0.2)' : 'none',
            }}
          >
            {p.popular && (
              <div
                className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                style={{
                  background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)',
                  fontFamily: 'Plus Jakarta Sans,sans-serif',
                }}
              >
                🏆 Most Popular
              </div>
            )}

            <div className="mb-5">
              <div
                className="text-sm font-bold mb-1"
                style={{ color: p.color, fontFamily: 'Plus Jakarta Sans,sans-serif' }}
              >
                {p.name}
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span
                  className="text-5xl font-black text-ink"
                  style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
                >
                  {p.planId === 'free'
                    ? 'Free'
                    : formatInr(INDIA_PAID_PLANS[p.planId].amountInr)}
                </span>
                {p.planId !== 'free' && <span className="text-muted text-sm">/{p.period}</span>}
              </div>
              <p className="text-muted text-sm">{p.desc}</p>
            </div>

            <div className="flex-1 space-y-2.5 mb-6">
              {p.features.map(f => (
                <div key={f} className="text-sm" style={{ color: f.startsWith('❌') ? '#667085' : '#172033' }}>
                  {f}
                </div>
              ))}
            </div>

            <button
              className="w-full py-3 rounded-xl font-bold text-sm cursor-pointer transition-all"
              onClick={() => choose(p.planId)}
              disabled={busy === p.planId || (p.planId !== 'free' && paymentsUnavailable)}
              style={{
                fontFamily: 'Plus Jakarta Sans,sans-serif',
                background: p.popular
                  ? 'linear-gradient(135deg,#6C5CE7,#8B5CF6)'
                  : `rgba(255,255,255,0.92)`,
                border: p.popular ? 'none' : '1px solid rgba(99,102,241,0.12)',
                color: p.popular ? 'white' : '#172033',
              }}
            >
              {profile?.plan === p.planId
                ? 'Current plan'
                : busy === p.planId
                  ? '…'
                  : p.planId !== 'free' && paymentsUnavailable
                    ? 'Coming soon'
                    : p.cta}
            </button>
          </div>
        ))}
      </div>
      {msg && (
        <p className="text-center text-sm mb-12" style={{ color: msgErr ? '#B42318' : '#0F8A68' }}>
          {msg}
        </p>
      )}

      {/* Tutor Monetization */}
      <div
        className="rounded-3xl p-10 mb-12"
        style={{
          background: 'linear-gradient(135deg, rgba(32,201,151,0.12), rgba(34,199,214,0.08))',
          border: '1px solid rgba(32,201,151,0.2)',
        }}
      >
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="badge badge-green mb-4">For Tutors</div>
            <h2
              className="text-3xl font-black text-ink mb-4"
              style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
            >
              Earn Teaching What{' '}
              <span style={{ color: '#20C997' }}>You Love</span>
            </h2>
            <p className="text-muted leading-relaxed mb-6">
              Create courses, offer 1-on-1 tutoring sessions, and build a sustainable income teaching on LearnSyra. We handle marketing, payments, and support — you focus on teaching.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className="btn-primary px-6 py-2.5"
                style={{ background: 'linear-gradient(135deg,#20C997,#22C7D6)' }}
                onClick={() => {}}
              >
                Become a Tutor →
              </button>
              <button className="btn-glass px-6 py-2.5">
                Learn More
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: '📚', title: 'Course Sales', desc: 'Earn 70% of every course sale. Set your own price.', value: '70%', label: 'Revenue Share' },
              { icon: '📅', title: '1-on-1 Sessions', desc: 'Set your own hourly rate. We take 15% platform fee.', value: '85%', label: 'You Keep' },
              { icon: '💰', title: 'Top Earners', desc: 'Our top tutors earn over $10,000/month teaching part-time.', value: '$10k+', label: 'Monthly' },
              { icon: '🌍', title: 'Global Reach', desc: 'Teach students from 180+ countries on one platform.', value: '180+', label: 'Countries' },
            ].map(c => (
              <div
                key={c.title}
                className="glass rounded-2xl p-4"
                style={{ background: 'rgba(32,201,151,0.08)', borderColor: 'rgba(32,201,151,0.15)' }}
              >
                <div className="text-2xl mb-2">{c.icon}</div>
                <div
                  className="text-2xl font-black text-success mb-0.5"
                  style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
                >
                  {c.value}
                </div>
                <div className="text-xs text-muted">{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-black text-ink mb-6 text-center" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          Common Questions
        </h2>
        {[
          { q: 'Can I switch plans anytime?', a: 'Yes, upgrade or downgrade your plan at any time. Changes take effect immediately.' },
          { q: 'Is there a student discount?', a: 'Yes! Students with a valid .edu email get 40% off Student Pro and Career Pro plans.' },
          { q: 'What payment methods do you accept?', a: 'In India we accept UPI, credit/debit cards, and net banking through Razorpay Checkout. International card payments via Stripe will be added later.' },
          { q: 'Do tutors need teaching credentials?', a: 'Not necessarily. We vet all tutors based on expertise and a teaching trial. Passion and knowledge matter more than credentials.' },
        ].map(f => (
          <div
            key={f.q}
            className="glass rounded-xl p-5 mb-3"
          >
            <div className="text-sm font-bold text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              {f.q}
            </div>
            <div className="text-sm text-muted leading-relaxed">{f.a}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
