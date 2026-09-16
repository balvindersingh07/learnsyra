import type { ResumeAnalysis } from '../../../lib/resumeAnalysis'

export default function ResumeAnalysisBar({
  analysis,
  expanded,
  onToggle,
}: {
  analysis: ResumeAnalysis
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <section className="rs-analysis">
      <div className="rs-analysis-metrics">
        <div className="rs-metric">
          <span className="rs-metric-label">Strength</span>
          <strong>{analysis.strength}</strong>
        </div>
        <div className="rs-metric">
          <span className="rs-metric-label">ATS</span>
          <strong>{analysis.ats}</strong>
        </div>
        <div className="rs-metric">
          <span className="rs-metric-label">Job Match</span>
          <strong>{analysis.jobMatch ?? '—'}</strong>
        </div>
        <button type="button" className="rs-btn rs-btn-ghost rs-analysis-toggle" onClick={onToggle}>
          {expanded ? 'Hide analysis' : 'Why these scores?'}
        </button>
      </div>
      {expanded && (
        <div className="rs-analysis-detail">
          <div>
            <p className="rs-analysis-heading">Strength</p>
            <ul>{analysis.strengthWhy.map(line => <li key={line}>{line}</li>)}</ul>
          </div>
          <div>
            <p className="rs-analysis-heading">ATS Readiness</p>
            <ul>{analysis.atsWhy.map(line => <li key={line}>{line}</li>)}</ul>
          </div>
          <div>
            <p className="rs-analysis-heading">Job Match</p>
            <ul>{analysis.jobMatchWhy.map(line => <li key={line}>{line}</li>)}</ul>
          </div>
          {analysis.improvements.length > 0 && (
            <div className="rs-analysis-improve">
              {analysis.improvements.slice(0, 3).map(item => (
                <p key={item.id}><strong>{item.label}.</strong> {item.action}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
