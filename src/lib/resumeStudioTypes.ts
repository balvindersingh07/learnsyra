export type ResumeTemplate =
  | 'minimal'
  | 'modern'
  | 'professional'
  | 'technical'
  | 'germany'
  | 'canada'
  | 'usa'
  | 'india'
  | 'australia'
  | 'global-ats'

export type ResumeSectionId =
  | 'contact'
  | 'summary'
  | 'target'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certs'
  | 'achievements'
  | 'languages'
  | 'publications'
  | 'volunteer'
  | 'extra'

export type ResumeFont = 'inter' | 'georgia' | 'ibm-plex' | 'source-serif' | 'system'
export type ResumeSpacing = 'compact' | 'normal' | 'relaxed'
export type SkillCategory = 'Technical' | 'Tools' | 'Languages' | 'Soft Skills'

export interface ResumeStyle {
  font: ResumeFont
  accentColor: string
  spacing: ResumeSpacing
  columns: 1 | 2
}

export interface ResumeLayoutItem {
  id: ResumeSectionId | string
  visible: boolean
  kind: 'builtin' | 'custom'
}

export interface ResumeCustomSection {
  id: string
  title: string
  body: string
  visible: boolean
}

export interface CoverLetterDoc {
  recipient: string
  company: string
  body: string
  signature: string
  updatedAt: string
}

export interface TemplateMeta {
  id: ResumeTemplate
  title: string
  desc: string
  family: string
  supportsPhoto: boolean
  defaultColumns: 1 | 2
  atsFocused: boolean
}

export const DEFAULT_STYLE: ResumeStyle = {
  font: 'inter',
  accentColor: '#1f2937',
  spacing: 'normal',
  columns: 1,
}

export const SECTION_CATALOG: { id: ResumeSectionId; label: string }[] = [
  { id: 'contact', label: 'Contact' },
  { id: 'summary', label: 'Professional Summary' },
  { id: 'target', label: 'Target Role' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'certs', label: 'Certifications' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'languages', label: 'Languages' },
  { id: 'publications', label: 'Publications' },
  { id: 'volunteer', label: 'Volunteer Work' },
  { id: 'extra', label: 'Additional Information' },
]

export const TEMPLATE_CATALOG: TemplateMeta[] = [
  { id: 'minimal', title: 'Minimal ATS', desc: 'Single-column ATS-first layout.', family: 'ats', supportsPhoto: false, defaultColumns: 1, atsFocused: true },
  { id: 'modern', title: 'Modern', desc: 'Contemporary layout with accent structure.', family: 'modern', supportsPhoto: true, defaultColumns: 1, atsFocused: false },
  { id: 'professional', title: 'Professional', desc: 'Traditional corporate resume.', family: 'professional', supportsPhoto: true, defaultColumns: 1, atsFocused: false },
  { id: 'technical', title: 'Technical', desc: 'Developer layout with skills emphasis.', family: 'technical', supportsPhoto: false, defaultColumns: 2, atsFocused: false },
  { id: 'germany', title: 'Germany / DACH', desc: 'Formal Lebenslauf structure for DACH markets.', family: 'germany', supportsPhoto: true, defaultColumns: 1, atsFocused: false },
  { id: 'canada', title: 'Canada', desc: 'Canadian-style balanced two-column resume.', family: 'canada', supportsPhoto: true, defaultColumns: 2, atsFocused: false },
  { id: 'usa', title: 'USA', desc: 'US-style achievement-focused resume.', family: 'usa', supportsPhoto: false, defaultColumns: 1, atsFocused: false },
  { id: 'india', title: 'India', desc: 'India market layout with education emphasis.', family: 'india', supportsPhoto: true, defaultColumns: 1, atsFocused: false },
  { id: 'australia', title: 'Australia', desc: 'Australian career summary format.', family: 'australia', supportsPhoto: false, defaultColumns: 1, atsFocused: false },
  { id: 'global-ats', title: 'Global ATS', desc: 'Plain global ATS parsing layout.', family: 'global-ats', supportsPhoto: false, defaultColumns: 1, atsFocused: true },
]

export function defaultLayout(): ResumeLayoutItem[] {
  return SECTION_CATALOG.map(s => ({ id: s.id, visible: s.id !== 'target', kind: 'builtin' as const }))
}

export function templateMeta(id: ResumeTemplate): TemplateMeta {
  return TEMPLATE_CATALOG.find(t => t.id === id) ?? TEMPLATE_CATALOG[0]
}

export function styleForTemplate(template: ResumeTemplate, style?: Partial<ResumeStyle>): ResumeStyle {
  const meta = templateMeta(template)
  const accentByTemplate: Partial<Record<ResumeTemplate, string>> = {
    modern: '#4f46e5',
    professional: '#1e3a5f',
    technical: '#0f766e',
    germany: '#111827',
    canada: '#b45309',
    usa: '#1d4ed8',
    india: '#7c2d12',
    australia: '#065f46',
    'global-ats': '#111827',
    minimal: '#374151',
  }
  const fontByTemplate: Partial<Record<ResumeTemplate, ResumeFont>> = {
    professional: 'georgia',
    technical: 'ibm-plex',
    germany: 'source-serif',
    usa: 'georgia',
    india: 'source-serif',
    australia: 'inter',
    'global-ats': 'system',
  }
  return {
    font: style?.font ?? fontByTemplate[template] ?? 'inter',
    accentColor: style?.accentColor ?? accentByTemplate[template] ?? '#1f2937',
    spacing: style?.spacing ?? 'normal',
    columns: style?.columns ?? meta.defaultColumns,
  }
}
