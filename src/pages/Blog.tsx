import { Link } from 'react-router-dom'
import { BLOG_POSTS, blogPostPath, formatBlogDate } from '../lib/blogPosts'
import { BlobField, Orb3D } from '../components/Soft3D'

export default function Blog() {
  const [featured, ...rest] = BLOG_POSTS

  return (
    <div className="pt-20 pb-24 px-6 max-w-7xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
      <section className="relative overflow-hidden rounded-3xl glass p-8 sm:p-12 mb-12">
        <BlobField />
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3 mb-5">
            <Orb3D emoji="📚" size={48} />
            <Orb3D emoji="✨" size={40} className="float" />
          </div>
          <div className="badge badge-primary mb-4">LearnSyra Blog</div>
          <h1
            className="text-4xl sm:text-5xl font-black text-ink mb-4"
            style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
          >
            Learn smarter.{' '}
            <span className="gradient-text">Build faster. Get career-ready.</span>
          </h1>
          <p className="text-muted text-lg leading-relaxed">
            Practical guides on AI learning, human tutors, real-world projects, interview prep, and the skills that
            actually get you hired.
          </p>
        </div>
      </section>

      {featured && (
        <Link
          to={blogPostPath(featured.slug)}
          className="block glass rounded-3xl p-6 sm:p-8 mb-10 card-hover"
          style={{ textDecoration: 'none', border: '1px solid rgba(255,255,255,0.5)' }}
        >
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="badge badge-accent">{featured.category}</span>
            <span className="text-xs text-muted">{formatBlogDate(featured.publishedAt)}</span>
            <span className="text-xs text-muted">· {featured.readMinutes} min read</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(79,140,255,0.1))',
                boxShadow: '0 8px 24px rgba(108,92,231,0.12)',
              }}
            >
              {featured.coverEmoji}
            </div>
            <div>
              <h2
                className="text-2xl sm:text-3xl font-black text-ink mb-2"
                style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
              >
                {featured.title}
              </h2>
              <p className="text-muted leading-relaxed mb-4">{featured.excerpt}</p>
              <span className="text-sm font-bold" style={{ color: '#6C5CE7' }}>
                Read article →
              </span>
            </div>
          </div>
        </Link>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rest.map(post => (
          <Link
            key={post.slug}
            to={blogPostPath(post.slug)}
            className="glass rounded-2xl p-6 card-hover flex flex-col h-full"
            style={{ textDecoration: 'none', border: '1px solid rgba(255,255,255,0.45)' }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-4"
              style={{ background: 'rgba(108,92,231,0.1)' }}
            >
              {post.coverEmoji}
            </div>
            <div className="badge badge-primary text-[10px] mb-3 w-fit">{post.category}</div>
            <h3
              className="text-lg font-black text-ink mb-2 leading-snug"
              style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}
            >
              {post.title}
            </h3>
            <p className="text-sm text-muted leading-relaxed mb-4 flex-1">{post.excerpt}</p>
            <div className="text-xs text-muted mt-auto">
              {formatBlogDate(post.publishedAt)} · {post.readMinutes} min
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
