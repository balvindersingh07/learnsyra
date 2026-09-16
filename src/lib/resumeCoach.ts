import type { ResumeDoc, ResumeExperience, ResumeProject, ResumeSkill } from './resumeBuilder'
import { generateSummary, improveBullet, projectBullets, rewriteSummary } from './resumeBuilder'

export type CoachAction =
  | 'improve-resume'
  | 'ats-friendly'
  | 'improve-summary'
  | 'improve-experience'
  | 'improve-bullet'
  | 'measurable-impact'
  | 'improve-skills'
  | 'fix-grammar'
  | 'concise'
  | 'professional'
  | 'tailor-job'

const GRAMMAR_FIXES: [RegExp, string][] = [
  [/\bi\b/g, 'I'],
  [/\s{2,}/g, ' '],
  [/\.\s*\./g, '.'],
  [/\bteh\b/gi, 'the'],
  [/\brecieve\b/gi, 'receive'],
  [/\bexperiance\b/gi, 'experience'],
  [/\bresponsable\b/gi, 'responsible'],
  [/\butilize\b/gi, 'use'],
  [/\bleverage\b/gi, 'use'],
]

function fixGrammar(text: string) {
  let next = text.trim()
  for (const [pattern, replacement] of GRAMMAR_FIXES) next = next.replace(pattern, replacement)
  if (next && !/[.!?]$/.test(next)) next += '.'
  return next
}

function hasMetric(text: string) {
  return /\d+%?|\b\d+\+?\b/.test(text)
}

function addMeasurableImpact(text: string, doc: ResumeDoc) {
  const base = fixGrammar(text)
  if (hasMetric(base)) return base
  const project = doc.projects.find(p => p.included)
  if (project?.score) {
    return `${base.replace(/\.$/, '')} (project score ${project.score}/100 on LearnSyra).`
  }
  return `${base.replace(/\.$/, '')} within the documented project scope.`
}

function improveSkills(skills: ResumeSkill[]) {
  const included = skills.filter(s => s.included)
  const rest = skills.filter(s => !s.included)
  const order = (s: ResumeSkill) => {
    const rank: Record<string, number> = { Technical: 0, Tools: 1, 'Soft Skills': 2, Languages: 3 }
    return rank[s.category] ?? 4
  }
  return [...included.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name)), ...rest]
}

function atsFriendlySummary(doc: ResumeDoc) {
  const skills = doc.skills.filter(s => s.included).map(s => s.name).slice(0, 6)
  const role = doc.targetRole || doc.contact.title || 'target role'
  const base = doc.summary.trim() || generateSummary(doc)
  const skillLine = skills.length ? ` Core skills: ${skills.join(', ')}.` : ''
  return fixGrammar(`${base.replace(/\.$/, '')}. Seeking ${role} opportunities.${skillLine}`)
}

function improveExperienceBlock(exp: ResumeExperience) {
  return {
    ...exp,
    bullets: exp.bullets.map(b => {
      const trimmed = b.trim()
      if (!trimmed) return b
      return improveBullet(fixGrammar(trimmed), 0)
    }),
  }
}

export function runCoachAction(doc: ResumeDoc, action: CoachAction, context?: { bullet?: string; experienceId?: string }) {
  let next: ResumeDoc = { ...doc, updatedAt: new Date().toISOString() }
  switch (action) {
    case 'improve-resume':
      next.summary = next.summary.trim().length < 40 ? generateSummary(next) : rewriteSummary(next.summary, 'improve', next)
      next.skills = improveSkills(next.skills)
      next.experience = next.experience.map(improveExperienceBlock)
      next.projects = next.projects.map(p => (p.included && p.bullets.filter(Boolean).length < 2 ? { ...p, bullets: projectBullets(p) } : p))
      break
    case 'ats-friendly':
      next.summary = atsFriendlySummary(next)
      next.skills = improveSkills(next.skills)
      break
    case 'improve-summary':
      next.summary = rewriteSummary(next.summary || generateSummary(next), 'improve', next)
      break
    case 'improve-experience':
      next.experience = next.experience.map(improveExperienceBlock)
      break
    case 'improve-bullet':
      if (context?.experienceId && context.bullet !== undefined) {
        next.experience = next.experience.map(exp =>
          exp.id === context.experienceId
            ? {
                ...exp,
                bullets: exp.bullets.map(b => (b === context.bullet ? improveBullet(fixGrammar(b), 0) : b)),
              }
            : exp,
        )
      }
      break
    case 'measurable-impact':
      next.experience = next.experience.map(exp => ({
        ...exp,
        bullets: exp.bullets.map(b => (b.trim() ? addMeasurableImpact(b, next) : b)),
      }))
      break
    case 'improve-skills':
      next.skills = improveSkills(next.skills)
      break
    case 'fix-grammar':
      next.summary = fixGrammar(next.summary)
      next.experience = next.experience.map(exp => ({ ...exp, bullets: exp.bullets.map(fixGrammar) }))
      next.projects = next.projects.map(p => ({ ...p, description: fixGrammar(p.description), bullets: p.bullets.map(fixGrammar) }))
      break
    case 'concise':
      next.summary = rewriteSummary(next.summary, 'concise', next)
      next.experience = next.experience.map(exp => ({
        ...exp,
        bullets: exp.bullets.map(b => b.trim().split('.').filter(Boolean)[0] ?? b),
      }))
      break
    case 'professional':
      next.summary = rewriteSummary(next.summary || generateSummary(next), 'career', next)
      break
    case 'tailor-job':
      if (next.jobTarget) {
        const have = new Set(next.skills.filter(s => s.included).map(s => s.name.toLowerCase()))
        const matched = next.jobTarget.matchedSkills.map(s => s.toLowerCase())
        next.skills = improveSkills(
          next.skills.map(s => ({
            ...s,
            included: s.included || matched.includes(s.name.toLowerCase()) || have.has(s.name.toLowerCase()),
          })),
        )
        if (!next.summary.toLowerCase().includes((next.targetRole || '').toLowerCase()) && next.targetRole) {
          next.summary = `${next.summary.trim()} Targeting ${next.targetRole}.`.trim()
        }
      }
      break
  }
  return next
}

export function coachActionLabel(action: CoachAction) {
  const labels: Record<CoachAction, string> = {
    'improve-resume': 'Improve Resume',
    'ats-friendly': 'Make ATS Friendly',
    'improve-summary': 'Improve Summary',
    'improve-experience': 'Improve Experience',
    'improve-bullet': 'Improve Bullet',
    'measurable-impact': 'Add Measurable Impact',
    'improve-skills': 'Improve Skills',
    'fix-grammar': 'Fix Grammar',
    concise: 'Make More Concise',
    professional: 'Make More Professional',
    'tailor-job': 'Tailor Resume For Job',
  }
  return labels[action]
}

export function generateCoverLetter(doc: ResumeDoc): { recipient: string; company: string; body: string; signature: string } {
  const name = doc.contact.name || 'Applicant'
  const role = doc.targetRole || doc.contact.title || 'the role'
  const company = doc.jobTarget?.company || doc.jobTarget?.title || 'your organization'
  const skills = doc.skills.filter(s => s.included).map(s => s.name).slice(0, 4)
  const projects = doc.projects.filter(p => p.included).map(p => p.title).slice(0, 2)
  const lines = [
    `Dear Hiring Manager,`,
    '',
    `I am applying for ${role}${company ? ` at ${company}` : ''}.`,
    doc.summary.trim() ? doc.summary.trim() : `I am building practical experience through LearnSyra coursework and projects.`,
    skills.length ? `Relevant skills from my background include ${skills.join(', ')}.` : '',
    projects.length ? `Selected project work includes ${projects.join(' and ')}.` : '',
    `I would welcome the opportunity to discuss how my existing experience aligns with your needs.`,
    '',
    `Sincerely,`,
    name,
  ].filter(Boolean)
  return {
    recipient: 'Hiring Manager',
    company,
    body: lines.join('\n'),
    signature: name,
  }
}

export function improveProjectDescription(project: ResumeProject) {
  if (project.bullets.filter(Boolean).length >= 2) return project
  return { ...project, bullets: projectBullets(project) }
}
