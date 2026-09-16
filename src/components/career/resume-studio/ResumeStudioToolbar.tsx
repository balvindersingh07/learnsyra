import type { ResumeTemplate } from '../../../lib/resumeBuilder'
import { templateMeta } from '../../../lib/resumeStudioTypes'

export default function ResumeStudioToolbar({
  resumeName,
  autosaveLabel,
  template,
  busySave,
  onTemplates,
  onPreview,
  onPdf,
  onDocx,
  onSave,
}: {
  resumeName: string
  autosaveLabel: string | null
  template: ResumeTemplate
  busySave: boolean
  onTemplates: () => void
  onPreview: () => void
  onPdf: () => void
  onDocx: () => void
  onSave: () => void
}) {
  const tpl = templateMeta(template)
  return (
    <header className="rs-toolbar">
      <div className="rs-toolbar-left">
        <div>
          <p className="rs-toolbar-kicker">LearnSyra Resume Studio</p>
          <h1 className="rs-toolbar-title">{resumeName}</h1>
        </div>
        <span className="rs-toolbar-status">{autosaveLabel ?? 'All changes saved locally'}</span>
      </div>
      <div className="rs-toolbar-meta">
        <span className="rs-toolbar-chip">{tpl.title}</span>
      </div>
      <div className="rs-toolbar-actions">
        <button type="button" className="rs-btn rs-btn-ghost" onClick={onTemplates}>Template</button>
        <button type="button" className="rs-btn rs-btn-ghost" onClick={onPreview}>Preview</button>
        <button type="button" className="rs-btn rs-btn-ghost" onClick={onPdf}>PDF</button>
        <button type="button" className="rs-btn rs-btn-ghost" onClick={onDocx}>DOCX</button>
        <button type="button" className="rs-btn rs-btn-primary" disabled={busySave} onClick={onSave}>{busySave ? 'Saving…' : 'Save'}</button>
      </div>
    </header>
  )
}
