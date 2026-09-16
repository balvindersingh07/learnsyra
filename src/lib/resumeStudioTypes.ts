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
  | 'software-engineer'
  | 'full-stack'
  | 'frontend'
  | 'backend'
  | 'react-native'
  | 'devops-cloud'
  | 'data-ai'
  | 'tech-professional'
  | 'modern-professional'

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
export type TemplateGroup = 'it' | 'regional'

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
  group: TemplateGroup
  supportsPhoto: boolean
  defaultColumns: 1 | 2
  atsFocused: boolean
  thumb: string
}

export const DEFAULT_STYLE: ResumeStyle = {
  font: 'inter',
  accentColor: '#1f2937',
  spacing: 'normal',
  columns: 1,
}

export const SECTION_CATALOG: { id: ResumeSectionId; label: string; icon: string }[] = [
  { id: 'contact', label: 'Contact', icon: 'ID' },
  { id: 'summary', label: 'Summary', icon: 'Σ' },
  { id: 'target', label: 'Target Role', icon: '◎' },
  { id: 'experience', label: 'Experience', icon: 'Exp' },
  { id: 'education', label: 'Education', icon: 'Ed' },
  { id: 'skills', label: 'Technical Skills', icon: 'Sk' },
  { id: 'projects', label: 'Projects', icon: 'Pr' },
  { id: 'certs', label: 'Certifications', icon: 'Ce' },
  { id: 'achievements', label: 'Achievements', icon: 'Ac' },
  { id: 'languages', label: 'Languages', icon: 'Ln' },
  { id: 'publications', label: 'Publications', icon: 'Pb' },
  { id: 'volunteer', label: 'Volunteer', icon: 'Vo' },
  { id: 'extra', label: 'Additional', icon: '+' },
]

const IT_TEMPLATES: TemplateMeta[] = [
  { id: 'software-engineer', title: 'Software Engineer', desc: 'Balanced engineering resume.', family: 'it', group: 'it', supportsPhoto: false, defaultColumns: 1, atsFocused: false, thumb: 'it-se' },
  { id: 'full-stack', title: 'Full Stack Developer', desc: 'Projects and stack forward.', family: 'it', group: 'it', supportsPhoto: false, defaultColumns: 2, atsFocused: false, thumb: 'it-fs' },
  { id: 'frontend', title: 'Frontend Developer', desc: 'UI engineering emphasis.', family: 'it', group: 'it', supportsPhoto: false, defaultColumns: 1, atsFocused: false, thumb: 'it-fe' },
  { id: 'backend', title: 'Backend Developer', desc: 'APIs, systems and services.', family: 'it', group: 'it', supportsPhoto: false, defaultColumns: 1, atsFocused: false, thumb: 'it-be' },
  { id: 'react-native', title: 'React / RN Developer', desc: 'React-focused portfolio layout.', family: 'it', group: 'it', supportsPhoto: false, defaultColumns: 1, atsFocused: false, thumb: 'it-rn' },
  { id: 'devops-cloud', title: 'DevOps / Cloud', desc: 'Infra and reliability focus.', family: 'it', group: 'it', supportsPhoto: false, defaultColumns: 2, atsFocused: false, thumb: 'it-devops' },
  { id: 'data-ai', title: 'Data / AI Engineer', desc: 'Data and ML project layout.', family: 'it', group: 'it', supportsPhoto: false, defaultColumns: 1, atsFocused: false, thumb: 'it-data' },
  { id: 'tech-professional', title: 'Technical Professional', desc: 'Clean corporate engineering.', family: 'it', group: 'it', supportsPhoto: true, defaultColumns: 1, atsFocused: false, thumb: 'it-tech' },
  { id: 'minimal', title: 'Minimal ATS', desc: 'Plain ATS-first layout.', family: 'ats', group: 'it', supportsPhoto: false, defaultColumns: 1, atsFocused: true, thumb: 'it-ats' },
  { id: 'modern-professional', title: 'Modern Professional', desc: 'Contemporary engineering resume.', family: 'modern', group: 'it', supportsPhoto: true, defaultColumns: 1, atsFocused: false, thumb: 'it-mod' },
]

const REGIONAL_TEMPLATES: TemplateMeta[] = [
  { id: 'modern', title: 'Modern', desc: 'Contemporary accent structure.', family: 'modern', group: 'regional', supportsPhoto: true, defaultColumns: 1, atsFocused: false, thumb: 'rg-modern' },
  { id: 'professional', title: 'Professional', desc: 'Traditional corporate.', family: 'professional', group: 'regional', supportsPhoto: true, defaultColumns: 1, atsFocused: false, thumb: 'rg-pro' },
  { id: 'technical', title: 'Technical', desc: 'Developer two-column layout.', family: 'technical', group: 'regional', supportsPhoto: false, defaultColumns: 2, atsFocused: false, thumb: 'rg-tech' },
  { id: 'germany', title: 'Germany / DACH', desc: 'Formal Lebenslauf.', family: 'germany', group: 'regional', supportsPhoto: true, defaultColumns: 1, atsFocused: false, thumb: 'rg-de' },
  { id: 'canada', title: 'Canada', desc: 'Canadian balanced layout.', family: 'canada', group: 'regional', supportsPhoto: false, defaultColumns: 2, atsFocused: false, thumb: 'rg-ca' },
  { id: 'usa', title: 'USA', desc: 'US achievement-focused.', family: 'usa', group: 'regional', supportsPhoto: false, defaultColumns: 1, atsFocused: false, thumb: 'rg-us' },
  { id: 'india', title: 'India', desc: 'Education-forward layout.', family: 'india', group: 'regional', supportsPhoto: true, defaultColumns: 1, atsFocused: false, thumb: 'rg-in' },
  { id: 'australia', title: 'Australia', desc: 'Career summary format.', family: 'australia', group: 'regional', supportsPhoto: false, defaultColumns: 1, atsFocused: false, thumb: 'rg-au' },
  { id: 'global-ats', title: 'Global ATS', desc: 'Machine-readable global ATS.', family: 'global-ats', group: 'regional', supportsPhoto: false, defaultColumns: 1, atsFocused: true, thumb: 'rg-ats' },
]

export const TEMPLATE_CATALOG: TemplateMeta[] = [...IT_TEMPLATES, ...REGIONAL_TEMPLATES]

export const TEMPLATE_GROUPS: { id: TemplateGroup; label: string }[] = [
  { id: 'it', label: 'IT & Software Engineering' },
  { id: 'regional', label: 'Regional & Market-Specific' },
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
    modern: '#1e3a5f',
    'modern-professional': '#1e40af',
    professional: '#1e3a5f',
    technical: '#0f766e',
    'software-engineer': '#0f172a',
    'full-stack': '#0369a1',
    frontend: '#4f46e5',
    backend: '#0f766e',
    'react-native': '#2563eb',
    'devops-cloud': '#155e75',
    'data-ai': '#4338ca',
    'tech-professional': '#1f2937',
    germany: '#111827',
    canada: '#92400e',
    usa: '#1d4ed8',
    india: '#7c2d12',
    australia: '#065f46',
    'global-ats': '#111827',
    minimal: '#374151',
  }
  const fontByTemplate: Partial<Record<ResumeTemplate, ResumeFont>> = {
    professional: 'georgia',
    'tech-professional': 'georgia',
    technical: 'ibm-plex',
    'software-engineer': 'ibm-plex',
    'devops-cloud': 'ibm-plex',
    germany: 'source-serif',
    usa: 'georgia',
    india: 'source-serif',
    australia: 'inter',
    'global-ats': 'system',
    minimal: 'system',
  }
  return {
    font: style?.font ?? fontByTemplate[template] ?? 'inter',
    accentColor: style?.accentColor ?? accentByTemplate[template] ?? '#1f2937',
    spacing: style?.spacing ?? 'normal',
    columns: style?.columns ?? meta.defaultColumns,
  }
}

export function sectionStatusLabel(state: 'done' | 'warn' | 'empty') {
  return state === 'done' ? 'Complete' : 'Needs information'
}
