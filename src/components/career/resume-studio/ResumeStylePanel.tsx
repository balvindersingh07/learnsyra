import type { ResumeDoc } from '../../../lib/resumeBuilder'
import { styleForTemplate, type ResumeFont, type ResumeSpacing } from '../../../lib/resumeStudioTypes'

const FONTS: { id: ResumeFont; label: string }[] = [
  { id: 'inter', label: 'Inter' },
  { id: 'georgia', label: 'Georgia' },
  { id: 'ibm-plex', label: 'IBM Plex' },
  { id: 'source-serif', label: 'Source Serif' },
  { id: 'system', label: 'System' },
]

const SPACING: { id: ResumeSpacing; label: string }[] = [
  { id: 'compact', label: 'Compact' },
  { id: 'normal', label: 'Normal' },
  { id: 'relaxed', label: 'Relaxed' },
]

const ACCENTS = ['#0f172a', '#1d4ed8', '#0f766e', '#4338ca', '#1e3a5f', '#374151']

export default function ResumeStylePanel({ doc, onChange }: { doc: ResumeDoc; onChange: (style: ResumeDoc['style']) => void }) {
  const style = doc.style ?? styleForTemplate(doc.template)
  return (
    <div className="rs-style-grid">
      <label className="rs-field">
        <span>Font</span>
        <select className="rs-input" value={style.font} onChange={e => onChange({ ...style, font: e.target.value as ResumeFont })}>
          {FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </label>
      <label className="rs-field">
        <span>Spacing</span>
        <select className="rs-input" value={style.spacing} onChange={e => onChange({ ...style, spacing: e.target.value as ResumeSpacing })}>
          {SPACING.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <label className="rs-field">
        <span>Columns</span>
        <select className="rs-input" value={style.columns} onChange={e => onChange({ ...style, columns: Number(e.target.value) as 1 | 2 })}>
          <option value={1}>1 column</option>
          <option value={2}>2 columns</option>
        </select>
      </label>
      <div className="rs-field">
        <span>Accent</span>
        <div className="rs-accent-row">
          {ACCENTS.map(color => (
            <button key={color} type="button" className={`rs-accent-swatch${style.accentColor === color ? ' rs-accent-swatch--on' : ''}`} style={{ background: color }} onClick={() => onChange({ ...style, accentColor: color })} />
          ))}
        </div>
      </div>
    </div>
  )
}
