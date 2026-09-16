import type { CSSProperties } from 'react'
import type { ResumeDoc } from '../../lib/resumeBuilder'
import { visibleSections } from '../../lib/resumeBuilder'
import { styleForTemplate, templateMeta } from '../../lib/resumeStudioTypes'
import { ResumeHeader, renderBuiltinSection, renderCustomSection } from './ResumeSectionViews'

export default function ResumePreview({
  doc,
  mode = 'desktop',
}: {
  doc: ResumeDoc
  mode?: 'desktop' | 'mobile'
}) {
  const style = doc.style ?? styleForTemplate(doc.template)
  const meta = templateMeta(doc.template)
  const showPhoto = Boolean(doc.contact.usePhoto && doc.contact.photoUrl && meta.supportsPhoto)
  const sections = visibleSections(doc)
  const mainSections = sections.filter(s => s.kind === 'builtin' && s.id !== 'contact')
  const sidebarIds = new Set(['skills', 'education', 'languages', 'certs'])
  const mainColumn = style.columns === 2
    ? mainSections.filter(s => !sidebarIds.has(s.id as string))
    : mainSections
  const sideColumn = style.columns === 2
    ? mainSections.filter(s => sidebarIds.has(s.id as string))
    : []

  const customSections = (doc.customSections ?? []).filter(s => s.visible)

  return (
    <article
      className={`rv-page rv-print ${mode === 'mobile' ? 'rv-mobile' : ''} rv-tpl-${doc.template}`}
      data-tpl={doc.template}
      data-columns={style.columns}
      data-spacing={style.spacing}
      data-font={style.font}
      style={{ '--rv-accent': style.accentColor } as CSSProperties}
      aria-label="Resume preview"
    >
      <ResumeHeader doc={doc} showPhoto={showPhoto} />

      {style.columns === 2 ? (
        <div className="rv-columns">
          <div className="rv-col-main">
            {mainColumn.map(item => renderBuiltinSection(doc, item.id as never))}
            {customSections.map(s => renderCustomSection(s))}
          </div>
          <aside className="rv-col-side">
            {sideColumn.map(item => renderBuiltinSection(doc, item.id as never))}
          </aside>
        </div>
      ) : (
        <>
          {mainColumn.map(item => renderBuiltinSection(doc, item.id as never))}
          {customSections.map(s => renderCustomSection(s))}
        </>
      )}
    </article>
  )
}
