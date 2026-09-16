import type { ResumeCustomSection, ResumeDoc, ResumeSectionId } from '../../lib/resumeBuilder'
import { templateMeta } from '../../lib/resumeStudioTypes'

function contactRows(doc: ResumeDoc) {
  const rows: { label: string; value: string }[] = []
  if (doc.contact.location) rows.push({ label: 'Location', value: doc.contact.location })
  if (doc.contact.email) rows.push({ label: 'Email', value: doc.contact.email })
  if (doc.contact.phone) rows.push({ label: 'Phone', value: doc.contact.phone })
  if (doc.contact.linkedin) rows.push({ label: 'LinkedIn', value: doc.contact.linkedin })
  if (doc.contact.github) rows.push({ label: 'GitHub', value: doc.contact.github })
  if (doc.contact.portfolio) rows.push({ label: 'Portfolio', value: doc.contact.portfolio })
  return rows
}

export function ResumeHeader({ doc, showPhoto }: { doc: ResumeDoc; showPhoto: boolean }) {
  const meta = templateMeta(doc.template)
  const photo = showPhoto && meta.supportsPhoto && doc.contact.usePhoto && doc.contact.photoUrl
  const rows = contactRows(doc)

  return (
    <header className={`rv-header ${photo ? 'rv-header--photo' : ''}`}>
      {photo && (
        <div className="rv-photo-wrap">
          <img src={doc.contact.photoUrl!} alt="" className="rv-photo" />
        </div>
      )}
      <div className="rv-header-main">
        <h1>{doc.contact.name || 'Your name'}</h1>
        <p className="rv-title">{doc.contact.title || doc.targetRole || 'Software Engineer'}</p>
        {rows.length > 0 && (
          <div className="rv-contact-grid">
            {rows.map(row => (
              <div key={row.label} className="rv-contact-item">
                <span className="rv-contact-label">{row.label}</span>
                <span className="rv-contact-value">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <h2>{children}</h2>
}

export function renderBuiltinSection(doc: ResumeDoc, id: ResumeSectionId) {
  const skills = doc.skills.filter(s => s.included)
  const projects = doc.projects.filter(p => p.included)
  const certs = doc.certifications.filter(c => c.included)
  const ach = doc.achievements.filter(a => a.included)
  const ats = templateMeta(doc.template).atsFocused

  switch (id) {
    case 'summary':
      if (!doc.summary.trim()) return null
      return (
        <section data-section="summary">
          <SectionTitle>Professional Summary</SectionTitle>
          <p className="rv-body">{doc.summary}</p>
        </section>
      )
    case 'target':
      if (!doc.targetRole.trim()) return null
      return (
        <section data-section="target">
          <SectionTitle>Target Role</SectionTitle>
          <p className="rv-body">{doc.targetRole}</p>
        </section>
      )
    case 'experience':
      if (!doc.experience.some(e => e.title || e.company)) return null
      return (
        <section data-section="experience">
          <SectionTitle>Experience</SectionTitle>
          {doc.experience.filter(e => e.title || e.company).map(e => (
            <div key={e.id} className="rv-entry">
              <div className="rv-entry-head">
                <p className="rv-entry-title">{e.title}</p>
                <p className="rv-entry-dates">{[e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' – ')}</p>
              </div>
              <p className="rv-entry-sub">{[e.company, e.location].filter(Boolean).join(' · ')}</p>
              <ul className="rv-list">{e.bullets.filter(Boolean).map(b => <li key={b}>{b}</li>)}</ul>
            </div>
          ))}
        </section>
      )
    case 'education':
      if (!doc.education.some(e => e.institution || e.degree)) return null
      return (
        <section data-section="education">
          <SectionTitle>Education</SectionTitle>
          {doc.education.filter(e => e.institution || e.degree).map(e => (
            <div key={e.id} className="rv-entry">
              <p className="rv-entry-title">{e.degree}</p>
              <p className="rv-entry-sub">{[e.institution, e.location].filter(Boolean).join(' · ')}</p>
              <p className="rv-entry-meta">{[e.startDate, e.endDate, e.grade].filter(Boolean).join(' · ')}</p>
              {e.coursework && <p className="rv-body">Relevant coursework: {e.coursework}</p>}
            </div>
          ))}
        </section>
      )
    case 'skills':
      if (!skills.length) return null
      return (
        <section data-section="skills">
          <SectionTitle>Technical Skills</SectionTitle>
          {ats ? (
            <p className="rv-body rv-skills-line">{skills.map(s => s.name).join(' · ')}</p>
          ) : (
            <div className="rv-skill-groups">
              {(['Technical', 'Tools', 'Languages', 'Soft Skills'] as const).map(cat => {
                const group = skills.filter(s => s.category === cat)
                if (!group.length) return null
                return (
                  <p key={cat} className="rv-body rv-skills-line">
                    <strong>{cat}:</strong> {group.map(s => s.name).join(', ')}
                  </p>
                )
              })}
            </div>
          )}
        </section>
      )
    case 'projects':
      if (!projects.length) return null
      return (
        <section data-section="projects">
          <SectionTitle>Projects</SectionTitle>
          {projects.map(p => (
            <div key={p.projectId} className="rv-entry">
              <p className="rv-entry-title">{p.title}</p>
              {p.skills.length > 0 && <p className="rv-tech-stack"><span>Tech Stack:</span> {p.skills.join(' · ')}</p>}
              <ul className="rv-list">{(p.bullets.length ? p.bullets : [p.description]).filter(Boolean).map(b => <li key={b}>{b}</li>)}</ul>
            </div>
          ))}
        </section>
      )
    case 'certs':
      if (!certs.length) return null
      return (
        <section data-section="certs">
          <SectionTitle>Certifications</SectionTitle>
          {certs.map(c => (
            <p key={c.id} className="rv-body">{c.title} — {c.issuer}, {c.completed}{!c.official ? ' (course record)' : ''}</p>
          ))}
        </section>
      )
    case 'achievements':
      if (!ach.length) return null
      return (
        <section data-section="achievements">
          <SectionTitle>Achievements</SectionTitle>
          <ul className="rv-list">{ach.map(a => <li key={a.id}>{a.label}</li>)}</ul>
        </section>
      )
    case 'languages':
      if (!doc.extra.languages.trim()) return null
      return (
        <section data-section="languages">
          <SectionTitle>Languages</SectionTitle>
          <p className="rv-body">{doc.extra.languages}</p>
        </section>
      )
    case 'publications':
      if (!doc.extra.publications.trim()) return null
      return (
        <section data-section="publications">
          <SectionTitle>Publications</SectionTitle>
          <p className="rv-body">{doc.extra.publications}</p>
        </section>
      )
    case 'volunteer':
      if (!doc.extra.volunteer.trim()) return null
      return (
        <section data-section="volunteer">
          <SectionTitle>Volunteer Work</SectionTitle>
          <p className="rv-body">{doc.extra.volunteer}</p>
        </section>
      )
    case 'extra':
      {
        const bits = [
          doc.extra.interests && `Interests: ${doc.extra.interests}`,
          doc.extra.awards && `Awards: ${doc.extra.awards}`,
          doc.extra.opensource && `Open source: ${doc.extra.opensource}`,
          doc.extra.links && doc.extra.links,
        ].filter(Boolean)
        if (!bits.length) return null
        return (
          <section data-section="extra">
            <SectionTitle>Additional Information</SectionTitle>
            {bits.map(b => <p key={b} className="rv-body">{b}</p>)}
          </section>
        )
      }
    default:
      return null
  }
}

export function renderCustomSection(section: ResumeCustomSection) {
  if (!section.visible || !section.title.trim() || !section.body.trim()) return null
  return (
    <section data-section={`custom-${section.id}`}>
      <SectionTitle>{section.title}</SectionTitle>
      <p className="rv-body">{section.body}</p>
    </section>
  )
}
