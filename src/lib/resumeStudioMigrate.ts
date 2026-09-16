import type { ResumeDoc } from './resumeBuilder'
import { defaultLayout, styleForTemplate, type ResumeLayoutItem, type ResumeTemplate } from './resumeStudioTypes'

const LEGACY_TEMPLATES = new Set(['minimal', 'modern', 'professional', 'technical'])

export function normalizeResumeDoc(raw: ResumeDoc): ResumeDoc {
  const template = LEGACY_TEMPLATES.has(raw.template) || isResumeTemplate(raw.template) ? raw.template : 'minimal'
  const layout = normalizeLayout(raw.layout)
  const style = raw.style ? { ...styleForTemplate(template), ...raw.style } : styleForTemplate(template)
  const contact = {
    ...raw.contact,
    photoUrl: raw.contact.photoUrl ?? null,
    usePhoto: raw.contact.usePhoto ?? Boolean(raw.contact.photoUrl),
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

function isResumeTemplate(value: string): value is ResumeTemplate {
  return [
    'minimal',
    'modern',
    'professional',
    'technical',
    'germany',
    'canada',
    'usa',
    'india',
    'australia',
    'global-ats',
  ].includes(value)
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
