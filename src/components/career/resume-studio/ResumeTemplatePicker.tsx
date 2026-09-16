import type { ResumeDoc, ResumeTemplate } from '../../../lib/resumeBuilder'
import { styleForTemplate, TEMPLATE_CATALOG, TEMPLATE_GROUPS, type TemplateMeta } from '../../../lib/resumeStudioTypes'

function TemplateThumb({ meta, active }: { meta: TemplateMeta; active: boolean }) {
  return (
    <div className={`rs-thumb rs-thumb--${meta.thumb}${active ? ' rs-thumb--active' : ''}`} aria-hidden="true">
      <div className="rs-thumb-page">
        <div className="rs-thumb-header" />
        <div className="rs-thumb-line rs-thumb-line--bold" />
        <div className="rs-thumb-line" />
        <div className="rs-thumb-line rs-thumb-line--short" />
        <div className="rs-thumb-block" />
        <div className="rs-thumb-line" />
        <div className="rs-thumb-line rs-thumb-line--short" />
      </div>
    </div>
  )
}

export default function ResumeTemplatePicker({
  doc,
  onSelect,
}: {
  doc: ResumeDoc
  onSelect: (template: ResumeTemplate) => void
}) {
  return (
    <div className="rs-template-picker">
      {TEMPLATE_GROUPS.map(group => (
        <div key={group.id} className="rs-template-group">
          <h3 className="rs-template-group-title">{group.label}</h3>
          <div className="rs-template-grid">
            {TEMPLATE_CATALOG.filter(t => t.group === group.id).map(t => (
              <button
                key={t.id}
                type="button"
                className={`rs-template-card${doc.template === t.id ? ' rs-template-card--active' : ''}`}
                onClick={() => onSelect(t.id)}
              >
                <TemplateThumb meta={t} active={doc.template === t.id} />
                <span className="rs-template-name">{t.title}</span>
                <span className="rs-template-desc">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function applyTemplate(doc: ResumeDoc, template: ResumeTemplate): ResumeDoc {
  const meta = TEMPLATE_CATALOG.find(t => t.id === template)!
  return {
    ...doc,
    template,
    style: styleForTemplate(template, { ...(doc.style ?? {}), columns: meta.defaultColumns }),
    contact: {
      ...doc.contact,
      usePhoto: meta.supportsPhoto ? doc.contact.usePhoto : false,
    },
  }
}
