import type { ResumeAnalysis } from '../../../lib/resumeAnalysis'

export default function ResumeAnalysisPanel({ analysis }: { analysis: ResumeAnalysis }) {
  return (
    <div className="grid lg:grid-cols-3 gap-4 mb-5">
      <section className="glass rounded-3xl p-5">
        <h2 className="text-base font-black text-ink mb-1">Resume Strength</h2>
        <div className="text-3xl font-black career-count mb-3">{analysis.strength} / 100</div>
        <ul className="text-sm space-y-1 text-muted">{analysis.strengthWhy.map(line => <li key={line}>• {line}</li>)}</ul>
      </section>
      <section className="glass rounded-3xl p-5">
        <h2 className="text-base font-black text-ink mb-1">ATS Readiness</h2>
        <div className="text-3xl font-black career-count mb-3">{analysis.ats} / 100</div>
        <ul className="text-sm space-y-1 text-muted">{analysis.atsWhy.map(line => <li key={line}>• {line}</li>)}</ul>
      </section>
      <section className="glass rounded-3xl p-5">
        <h2 className="text-base font-black text-ink mb-1">Job Match</h2>
        <div className="text-3xl font-black career-count mb-3">{analysis.jobMatch ?? '—'}{analysis.jobMatch !== null ? ' / 100' : ''}</div>
        <ul className="text-sm space-y-1 text-muted">{analysis.jobMatchWhy.map(line => <li key={line}>• {line}</li>)}</ul>
      </section>
      <section className="glass rounded-3xl p-5 lg:col-span-3">
        <h2 className="text-base font-black text-ink mb-2">Actionable Improvements</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {analysis.improvements.map(item => (
            <article key={item.id} className="rounded-2xl p-3" style={{ border: '1px solid rgba(99,102,241,0.12)' }}>
              <p className="text-sm font-bold text-ink">{item.label}</p>
              <p className="text-xs text-muted mt-1">{item.scoreImpact}</p>
              <p className="text-sm mt-2">{item.action}</p>
            </article>
          ))}
        </div>
        {analysis.weakBullets.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-bold text-ink mb-1">Weak bullets</p>
            <ul className="text-sm text-muted list-disc pl-5">{analysis.weakBullets.map(b => <li key={b}>{b}</li>)}</ul>
          </div>
        )}
      </section>
    </div>
  )
}
