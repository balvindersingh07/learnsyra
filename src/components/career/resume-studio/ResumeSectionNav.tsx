import type { ResumeDoc, ResumeSectionId } from '../../../lib/resumeBuilder'
import { sectionState } from '../../../lib/resumeBuilder'
import { defaultLayout, SECTION_CATALOG, sectionStatusLabel } from '../../../lib/resumeStudioTypes'

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
    <nav className="rs-nav" aria-label="Resume sections">
      <p className="rs-nav-title">Sections</p>
      <ul className="rs-nav-list">
        {layout.map((item, index) => {
          if (item.kind !== 'builtin') return null
          const section = SECTION_CATALOG.find(s => s.id === item.id)
          if (!section) return null
          const st = sectionState(doc, section.id)
          const isActive = active === section.id
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
            >
              <button
                type="button"
                className={`rs-nav-item${isActive ? ' rs-nav-item--active' : ''}${!item.visible ? ' rs-nav-item--hidden' : ''}`}
                onClick={() => onSelect(section.id)}
              >
                <span className="rs-nav-icon">{section.icon}</span>
                <span className="rs-nav-text">
                  <span className="rs-nav-label">{section.label}</span>
                  <span className={`rs-nav-status rs-nav-status--${st}`}>{sectionStatusLabel(st)}</span>
                </span>
              </button>
              {section.id !== 'contact' && (
                <button type="button" className="rs-nav-toggle" onClick={() => onToggle(section.id, !item.visible)} title={item.visible ? 'Hide section' : 'Show section'}>
                  {item.visible ? '−' : '+'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
