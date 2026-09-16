import type { ResumeDoc } from './resumeBuilder'
import { scoreResume } from './resumeBuilder'

export interface AnalysisInsight {
  id: string
  label: string
  scoreImpact: string
  action: string
  severity: 'good' | 'warn' | 'critical'
}

export interface ResumeAnalysis {
  strength: number
  ats: number
  jobMatch: number | null
  strengthWhy: string[]
  atsWhy: string[]
  jobMatchWhy: string[]
  improvements: AnalysisInsight[]
  weakBullets: string[]
  missingKeywords: string[]
  missingSkills: string[]
}

function weakBullets(doc: ResumeDoc) {
  return doc.experience
    .flatMap(exp => exp.bullets.filter(b => b.trim().length > 0))
    .filter(b => b.trim().length < 24 || /^worked on/i.test(b) || !/[.!?]$/.test(b))
}

export function analyzeResume(doc: ResumeDoc): ResumeAnalysis {
  const scores = scoreResume(doc)
  const weak = weakBullets(doc)
  const strengthWhy = [
    scores.contact ? 'Contact details are complete.' : 'Contact section is incomplete.',
    scores.summary ? 'Professional summary meets length guidance.' : 'Summary is missing or too short.',
    scores.skills ? 'At least three skills are included.' : 'Fewer than three skills are included.',
    scores.projects ? 'At least one project is included.' : 'No projects are included on the resume.',
    scores.education ? 'Education section is present.' : 'Education section is empty.',
    scores.experience >= 70 ? 'Experience section has usable bullet content.' : 'Experience bullets need more detail.',
  ]
  const atsWhy = [
    `Keyword coverage for ${doc.targetRole}: ${scores.keywords}/100.`,
    `Structure score: ${scores.structure}/100 based on section completeness.`,
    `Readability score: ${scores.readability}/100 from summary length and clarity.`,
    `Role match estimate: ${scores.roleMatch}/100 from listed skills and projects.`,
    scores.missingKeywords.length
      ? `Missing role keywords: ${scores.missingKeywords.join(', ')}.`
      : 'No major missing keywords detected for the selected role.',
  ]
  const jobMatch = doc.jobTarget?.matchScore ?? null
  const jobMatchWhy = doc.jobTarget
    ? [
        `Matched skills from your resume: ${doc.jobTarget.matchedSkills.join(', ') || 'none yet'}.`,
        `Skills mentioned in the job description but not on your resume: ${doc.jobTarget.missingSkills.join(', ') || 'none'}.`,
        'Tailoring only reorders or rephrases content you already have — it does not invent experience.',
      ]
    : ['Paste a job description to calculate job match.']
  const improvements: AnalysisInsight[] = []
  if (!scores.summary) {
    improvements.push({
      id: 'summary',
      label: 'Add a stronger summary',
      scoreImpact: 'Improves strength and ATS readability',
      action: 'Write 2–4 sentences using skills and projects you already have.',
      severity: 'critical',
    })
  }
  if (weak.length) {
    improvements.push({
      id: 'bullets',
      label: 'Strengthen experience bullets',
      scoreImpact: `Weak bullets detected (${weak.length})`,
      action: 'Use action verbs and clarify outcomes from work you actually did.',
      severity: 'warn',
    })
  }
  if (scores.missingKeywords.length) {
    improvements.push({
      id: 'keywords',
      label: 'Address missing keywords',
      scoreImpact: 'Improves ATS keyword score',
      action: `Only add keywords you can support: ${scores.missingKeywords.join(', ')}.`,
      severity: 'warn',
    })
  }
  if (doc.jobTarget?.missingSkills.length) {
    improvements.push({
      id: 'job-skills',
      label: 'Job-specific skill gaps',
      scoreImpact: 'Lowers job match until supported by your profile',
      action: `Do not invent these skills: ${doc.jobTarget.missingSkills.join(', ')}.`,
      severity: 'warn',
    })
  }
  if (scores.ats >= 80 && scores.completeness >= 80) {
    improvements.push({
      id: 'strong',
      label: 'Resume is in good shape',
      scoreImpact: 'Maintain accuracy as you add verified experience',
      action: 'Tailor for specific roles using the job description workflow.',
      severity: 'good',
    })
  }
  return {
    strength: scores.completeness,
    ats: scores.ats,
    jobMatch,
    strengthWhy,
    atsWhy,
    jobMatchWhy,
    improvements,
    weakBullets: weak.slice(0, 8),
    missingKeywords: scores.missingKeywords,
    missingSkills: doc.jobTarget?.missingSkills ?? [],
  }
}
