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

const ACCENTS = ['#1f2937', '#1d4ed8', '#0f766e', '#7c2d12', '#4f46e5', '#b45309', '#111827']

export default function ResumeStylePanel({ doc, onChange }: { doc: ResumeDoc; onChange: (style: ResumeDoc['style']) => void }) {
  const style = doc.style ?? styleForTemplate(doc.template)
  return (
    <section className="glass rounded-3xl p-5 mb-6">
      <h2 className="text-lg font-black text-ink mb-3">Visual Customization</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="block text-sm">
          <span className="text-xs font-semibold text-muted uppercase">Font</span>
          <select className="field w-full mt-1 px-3 py-2 text-sm" value={style.font} onChange={e => onChange({ ...style, font: e.target.value as ResumeFont })}>
            {FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-muted uppercase">Spacing</span>
          <select className="field w-full mt-1 px-3 py-2 text-sm" value={style.spacing} onChange={e => onChange({ ...style, spacing: e.target.value as ResumeSpacing })}>
            {SPACING.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-muted uppercase">Layout</span>
          <select className="field w-full mt-1 px-3 py-2 text-sm" value={style.columns} onChange={e => onChange({ ...style, columns: Number(e.target.value) as 1 | 2 })}>
            <option value={1}>1 column</option>
            <option value={2}>2 columns</option>
          </select>
        </label>
        <div>
          <p className="text-xs font-semibold text-muted uppercase mb-2">Accent color</p>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map(color => (
              <button
                key={color}
                type="button"
                className="w-8 h-8 rounded-full border"
                style={{ background: color, borderColor: style.accentColor === color ? '#6C5CE7' : 'transparent' }}
                onClick={() => onChange({ ...style, accentColor: color })}
                aria-label={`Accent ${color}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
