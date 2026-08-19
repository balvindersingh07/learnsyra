import { NavLink } from 'react-router-dom'
import { careerInterviewPath, careerJobsPath, careerResumePath } from '../../lib/paths'

const LINKS = [
  { to: '/career', label: 'Overview', end: true },
  { to: careerInterviewPath(), label: 'Interview' },
  { to: careerResumePath(), label: 'Resume' },
  { to: careerJobsPath(), label: 'Jobs' },
]

export default function CareerHubNav() {
  return (
    <nav aria-label="Career Center sections" className="flex flex-wrap gap-2 mb-8">
      {LINKS.map(l => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            `px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              isActive ? 'text-primary' : 'text-muted'
            }`
          }
          style={({ isActive }) => ({
            fontFamily: 'Plus Jakarta Sans,sans-serif',
            background: isActive ? 'rgba(108,92,231,0.16)' : 'rgba(255,255,255,0.9)',
            border: `1px solid ${isActive ? 'rgba(108,92,231,0.35)' : 'rgba(99,102,241,0.12)'}`,
          })}
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  )
}
