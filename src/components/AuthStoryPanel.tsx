import { useState } from 'react'
import { BlobField, Orb3D } from './Soft3D'
import BrandMark from './BrandMark'

const stories = [
  {
    name: 'Priya Sharma',
    path: 'Non-tech background → Frontend Dev @ Google',
    img: 'photo-1488426862026-3ee34a7d66df',
    company: 'Google',
    text: 'LearnSyra helped me go from zero to a Google offer in 8 months. The AI tutor explained concepts better than any YouTube video, and mock interviews gave me real confidence.',
  },
  {
    name: 'Marcus Johnson',
    path: 'Career switch → Data Analyst @ Meta',
    img: 'photo-1506794778202-cad84cf45f1d',
    company: 'Meta',
    text: 'AI learning plus human tutors is unmatched. My tutor helped me land 3 interviews in one week. The projects on my portfolio did the rest.',
  },
  {
    name: 'Elena Vasquez',
    path: 'Self-taught → Product Manager @ Stripe',
    img: 'photo-1438761681033-6461ffad8d80',
    company: 'Stripe',
    text: 'The career center and mock interviews gave me the confidence I needed. I got my PM role after 6 months on LearnSyra.',
  },
]

export default function AuthStoryPanel() {
  const [story] = useState(() => stories[Math.floor(Math.random() * stories.length)])

  return (
    <section
      className="relative overflow-hidden flex flex-col px-8 lg:px-14 py-10"
      style={{
        background: 'linear-gradient(165deg, #EEF3FA 0%, #F7F9FC 42%, #EDE8FF 100%)',
      }}
    >
      <BlobField />
      <div className="relative z-10 flex items-center gap-2 mb-10">
        <BrandMark size={48} withWordmark wordmarkClass="text-xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <Orb3D emoji="🎓" size={52} />
          <Orb3D emoji="🧠" size={44} className="float" />
          <Orb3D emoji="💼" size={40} className="float2" />
        </div>

        <div className="glass rounded-3xl p-6 card-hover" style={{ boxShadow: '0 24px 60px rgba(108,92,231,0.12)' }}>
          <div className="flex items-start gap-3 mb-4">
            <img
              src={`https://images.unsplash.com/${story.img}?w=72&h=72&fit=crop&auto=format`}
              alt={story.name}
              className="w-14 h-14 rounded-2xl object-cover -mt-8 shadow-lg"
              style={{ border: '3px solid #fff' }}
            />
            <div className="pt-1">
              <div className="text-base font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                {story.name}
              </div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: '#6C5CE7' }}>
                {story.path}
              </div>
              <div className="badge badge-green mt-2">{story.company} · Hired</div>
            </div>
          </div>
          <p className="text-muted text-sm leading-relaxed">"{story.text}"</p>
        </div>

        <p
          className="text-ink font-bold text-2xl lg:text-3xl leading-snug mt-8"
          style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.03em' }}
        >
          Take a moonshot at your career.{' '}
          <span className="gradient-text">Learn. Build. Get Ready for the Future.</span>
        </p>
        <p className="text-muted mt-3 text-sm">
          AI-powered learning + expert tutors + real projects + career preparation — all in one platform.
        </p>
      </div>
    </section>
  )
}
