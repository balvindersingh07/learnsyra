import { Link, useParams } from 'react-router-dom'
import { getBlogPost, formatBlogDate, type BlogSection } from '../lib/blogPosts'

function Section({ section }: { section: BlogSection }) {
  if (section.type === 'h2') {
    return (
      <h2
        className="text-2xl font-black text-ink mt-10 mb-4"
        style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
      >
        {section.text}
      </h2>
    )
  }
  if (section.type === 'ul') {
    return (
      <ul className="list-disc pl-6 space-y-2 text-muted leading-relaxed mb-4">
        {section.items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }
  return <p className="text-muted leading-relaxed mb-4">{section.text}</p>
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getBlogPost(slug) : undefined

  if (!post) {
    return (
      <div className="pt-24 px-6 max-w-3xl mx-auto text-center">
        <h1 className="text-2xl font-black text-ink mb-3">Article not found</h1>
        <p className="text-muted mb-6">This post may have moved or does not exist.</p>
        <Link to="/blog" className="btn-primary inline-flex px-6 py-3" style={{ textDecoration: 'none' }}>
          Back to Blog
        </Link>
      </div>
    )
  }

  return (
    <article className="pt-20 pb-24 px-6 max-w-3xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
      <Link to="/blog" className="text-sm font-semibold mb-6 inline-block" style={{ color: '#6C5CE7', textDecoration: 'none' }}>
        ← Back to Blog
      </Link>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="badge badge-accent">{post.category}</span>
        {post.tags.map(tag => (
          <span key={tag} className="badge text-[10px]" style={{ background: 'rgba(108,92,231,0.08)' }}>
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(79,140,255,0.1))',
          }}
        >
          {post.coverEmoji}
        </div>
        <div>
          <h1
            className="text-3xl sm:text-4xl font-black text-ink leading-tight"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
          >
            {post.title}
          </h1>
          <p className="text-sm text-muted mt-2">
            {post.author} · {formatBlogDate(post.publishedAt)} · {post.readMinutes} min read
          </p>
        </div>
      </div>

      <p className="text-lg text-ink/90 leading-relaxed mb-8 glass rounded-2xl p-5">{post.excerpt}</p>

      <div className="prose-like">
        {post.sections.map((section, i) => (
          <Section key={i} section={section} />
        ))}
      </div>

      <div
        className="mt-12 rounded-2xl p-6 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(108,92,231,0.08), rgba(79,140,255,0.06))',
          border: '1px solid rgba(108,92,231,0.15)',
        }}
      >
        <h2
          className="text-xl font-black text-ink mb-2"
          style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
        >
          Ready to put this into practice?
        </h2>
        <p className="text-muted text-sm mb-4">
          Join LearnSyra — AI learning, expert tutors, projects, and career prep in one place.
        </p>
        <Link to="/" className="btn-primary inline-flex px-6 py-3" style={{ textDecoration: 'none' }}>
          Get Started
        </Link>
      </div>
    </article>
  )
}
