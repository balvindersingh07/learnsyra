import type { ResumeDoc } from './resumeBuilder'
import { defaultLayout, styleForTemplate, TEMPLATE_CATALOG, type ResumeLayoutItem, type ResumeTemplate } from './resumeStudioTypes'

const VALID = new Set(TEMPLATE_CATALOG.map(t => t.id))

export function normalizeResumeDoc(raw: ResumeDoc): ResumeDoc {
  const template = VALID.has(raw.template as ResumeTemplate) ? raw.template : 'minimal'
  const layout = normalizeLayout(raw.layout)
  const style = raw.style ? { ...styleForTemplate(template), ...raw.style } : styleForTemplate(template)
  const meta = TEMPLATE_CATALOG.find(t => t.id === template)
  const contact = {
    ...raw.contact,
    photoUrl: raw.contact.photoUrl ?? null,
    usePhoto: meta?.supportsPhoto ? (raw.contact.usePhoto ?? Boolean(raw.contact.photoUrl)) : false,
  }
  const extra = raw.extra ?? {
    languages: '',
    interests: '',
    volunteer: '',
    publications: '',
    awards: '',
    opensource: '',
    links: '',
  }
  return {
    ...raw,
    template,
    contact,
    extra,
    layout,
    style,
    customSections: raw.customSections ?? [],
    coverLetter: raw.coverLetter ?? null,
    autosaveNote: raw.autosaveNote ?? null,
  }
}

function normalizeLayout(layout?: ResumeLayoutItem[]): ResumeLayoutItem[] {
  if (!layout?.length) return defaultLayout()
  const known = new Set(defaultLayout().map(s => s.id))
  const merged = defaultLayout().map(item => {
    const found = layout.find(l => l.id === item.id)
    return found ? { ...item, visible: found.visible } : item
  })
  const extras = layout.filter(l => !known.has(l.id as never))
  return [...merged, ...extras]
}
