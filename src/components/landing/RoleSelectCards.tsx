import { Link } from 'react-router-dom'
import { ROLE_OPTIONS, authLoginPath } from '../../lib/authFlow'

interface Props {
  compact?: boolean
}

export default function RoleSelectCards({ compact = false }: Props) {
  return (
    <div className={`grid sm:grid-cols-2 ${compact ? 'gap-3' : 'gap-4 sm:gap-5'}`}>
      {ROLE_OPTIONS.map(option => (
        <Link
          key={option.id}
          to={authLoginPath(option.id)}
          className={`glass rounded-3xl text-left group card-hover ${
            compact ? 'p-5' : 'p-6 sm:p-7'
          }`}
          style={{
            boxShadow: '0 20px 50px rgba(108,92,231,0.1)',
            textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.65)',
          }}
        >
          <div
            className={`rounded-2xl flex items-center justify-center mb-4 ${
              compact ? 'w-12 h-12 text-xl' : 'w-14 h-14 text-2xl'
            }`}
            style={{
              background: 'linear-gradient(135deg, rgba(108,92,231,0.18), rgba(79,140,255,0.12))',
              boxShadow: '0 8px 24px rgba(108,92,231,0.15)',
            }}
          >
            {option.emoji}
          </div>
          <h2
            className={`font-black text-ink mb-1 ${compact ? 'text-lg' : 'text-xl'}`}
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
          >
            {option.label}
          </h2>
          <p className="text-sm font-semibold mb-2" style={{ color: '#6C5CE7' }}>
            {option.headline}
          </p>
          {!compact && (
            <p className="text-sm text-muted leading-relaxed mb-4">{option.description}</p>
          )}
          <span
            className="inline-flex items-center gap-1 text-sm font-bold"
            style={{ color: '#6C5CE7', fontFamily: 'Plus Jakarta Sans,sans-serif' }}
          >
            Continue as {option.label}
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
