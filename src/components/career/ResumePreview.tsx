import type { ResumeDoc } from '../../lib/resumeBuilder'

export default function ResumePreview({
  doc,
  mode = 'desktop',
}: {
  doc: ResumeDoc
  mode?: 'desktop' | 'mobile'
}) {
  const skills = doc.skills.filter(s => s.included)
  const projects = doc.projects.filter(p => p.included)
  const certs = doc.certifications.filter(c => c.included)
  const ach = doc.achievements.filter(a => a.included)
  const extraBits = [
    doc.extra.languages && `Languages: ${doc.extra.languages}`,
    doc.extra.interests && `Interests: ${doc.extra.interests}`,
    doc.extra.volunteer && `Volunteer: ${doc.extra.volunteer}`,
    doc.extra.opensource && `Open source: ${doc.extra.opensource}`,
    doc.extra.links && doc.extra.links,
  ].filter(Boolean)

  return (
    <article
      className={`rv-page rv-print ${mode === 'mobile' ? 'rv-mobile' : ''}`}
      data-tpl={doc.template}
      aria-label="Resume preview"
    >
      <header>
        <h1>{doc.contact.name || 'Your name'}</h1>
        <p style={{ margin: 0, fontWeight: 600 }}>{doc.contact.title || doc.targetRole}</p>
        <p style={{ margin: '6px 0 0', color: '#6b7280' }}>
          {[doc.contact.email, doc.contact.phone, doc.contact.location, doc.contact.linkedin, doc.contact.github, doc.contact.portfolio]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      {doc.summary && (
        <section>
          <h2>Summary</h2>
          <p style={{ margin: 0 }}>{doc.summary}</p>
        </section>
      )}

      {doc.experience.some(e => e.title || e.company) && (
        <section>
          <h2>Experience</h2>
          {doc.experience.filter(e => e.title || e.company).map(e => (
            <div key={e.id} style={{ marginBottom: 10 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {e.title} {e.company ? `· ${e.company}` : ''}
              </p>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 11 }}>
                {[e.location, e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' · ')}
              </p>
              <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                {e.bullets.filter(Boolean).map(b => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {skills.length > 0 && (
        <section>
          <h2>Skills</h2>
          <p style={{ margin: 0 }}>{skills.map(s => s.name).join(' · ')}</p>
        </section>
      )}

      {projects.length > 0 && (
        <section>
          <h2>Projects</h2>
          {projects.map(p => (
            <div key={p.projectId} style={{ marginBottom: 10 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{p.title}</p>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 11 }}>{p.skills.join(' · ')}</p>
              <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                {(p.bullets.length ? p.bullets : [p.description]).filter(Boolean).map(b => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {doc.education.some(e => e.institution || e.degree) && (
        <section>
          <h2>Education</h2>
          {doc.education.filter(e => e.institution || e.degree).map(e => (
            <p key={e.id} style={{ margin: '0 0 6px' }}>
              <strong>{e.degree}</strong>
              {e.institution ? `, ${e.institution}` : ''}
              {e.endDate ? ` · ${e.endDate}` : ''}
              {e.grade ? ` · ${e.grade}` : ''}
            </p>
          ))}
        </section>
      )}

      {certs.length > 0 && (
        <section>
          <h2>Certifications</h2>
          {certs.map(c => (
            <p key={c.id} style={{ margin: '0 0 4px' }}>
              {c.title} — {c.issuer}, {c.completed}
              {!c.official ? ' (LearnSyra course record)' : ''}
            </p>
          ))}
        </section>
      )}

      {ach.length > 0 && (
        <section>
          <h2>Achievements</h2>
          <p style={{ margin: 0 }}>{ach.map(a => a.label).join(' · ')}</p>
        </section>
      )}

      {extraBits.length > 0 && (
        <section>
          <h2>Additional</h2>
          {extraBits.map(b => (
            <p key={b} style={{ margin: '0 0 4px' }}>{b}</p>
          ))}
        </section>
      )}
    </article>
  )
}
