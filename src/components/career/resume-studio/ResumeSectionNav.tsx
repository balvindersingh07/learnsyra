import type { ResumeDoc, ResumeSectionId } from '../../../lib/resumeBuilder'
import { defaultLayout, SECTION_CATALOG } from '../../../lib/resumeStudioTypes'
import { sectionState } from '../../../lib/resumeBuilder'

export default function ResumeSectionNav({
  doc,
  active,
  onSelect,
  onReorder,
  onToggle,
}: {
  doc: ResumeDoc
  active: ResumeSectionId | 'custom'
  onSelect: (id: ResumeSectionId) => void
  onReorder: (from: number, to: number) => void
  onToggle: (id: ResumeSectionId, visible: boolean) => void
}) {
  const layout = doc.layout?.length ? doc.layout : defaultLayout()

  return (
    <nav className="glass rounded-3xl p-4" aria-label="Resume sections">
      <h2 className="text-sm font-black text-ink mb-3">Resume Sections</h2>
      <ul className="space-y-1">
        {layout.map((item, index) => {
          if (item.kind !== 'builtin') return null
          const section = SECTION_CATALOG.find(s => s.id === item.id)
          if (!section) return null
          const st = sectionState(doc, section.id)
          return (
            <li
              key={section.id}
              draggable
              onDragStart={e => e.dataTransfer.setData('text/plain', String(index))}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const from = Number(e.dataTransfer.getData('text/plain'))
                if (!Number.isNaN(from) && from !== index) onReorder(from, index)
              }}
              className="rounded-xl"
            >
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="text-xs text-muted cursor-grab" aria-hidden="true">⋮⋮</span>
                <button
                  type="button"
                  className="flex-1 text-left px-2 py-2 rounded-xl text-sm"
                  style={{ background: active === section.id ? 'rgba(108,92,231,0.12)' : 'transparent', color: active === section.id ? '#5B4BD6' : '#172033' }}
                  onClick={() => onSelect(section.id)}
                >
                  {section.label} {st === 'done' ? '✓' : st === 'warn' ? '⚠' : ''}
                </button>
                {section.id !== 'contact' && (
                  <button
                    type="button"
                    className="text-[10px] px-2 py-1 rounded-lg btn-glass"
                    onClick={() => onToggle(section.id, !item.visible)}
                  >
                    {item.visible ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {(doc.customSections ?? []).length > 0 && (
        <div className="mt-3 text-xs text-muted">Custom sections appear at the end of the preview.</div>
      )}
    </nav>
  )
}
