import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getLiveClass,
  isJitsiUrl,
  markLiveAttendance,
  toMediaEmbed,
  type LiveClass,
} from '../lib/api'

export default function LiveRoom() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile, session } = useAuth()
  const [row, setRow] = useState<LiveClass | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getLiveClass(id)
      .then(async c => {
        setRow(c)
        if (c?.status === 'live') await markLiveAttendance(c.id)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load class'))
  }, [id])

  const name = (profile?.full_name || session?.user.email || 'Student').replace(/"/g, '')
  const jitsiSrc = useMemo(() => {
    if (!row || !isJitsiUrl(row.meeting_url)) return null
    const base = row.meeting_url.split('#')[0]
    return `${base}#userInfo.displayName="${name}"`
  }, [row, name])
  const recording = toMediaEmbed(row?.recording_url ?? null)

  if (error) {
    return (
      <div className="pt-24 px-6 max-w-xl mx-auto">
        <div className="glass rounded-2xl p-8 text-center text-rose-500">{error}</div>
      </div>
    )
  }

  if (!row) {
    return <div className="pt-24 px-6 text-center text-muted">Loading class…</div>
  }

  const canJoin = row.status === 'live' || row.status === 'scheduled'
  const showRecording = row.status === 'ended' || Boolean(row.recording_url)

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <button
          className="text-sm text-muted mb-4 cursor-pointer"
          style={{ background: 'none', border: 'none' }}
          onClick={() => navigate('/live')}
        >
          ← All live classes
        </button>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {row.status === 'live' && <span className="badge badge-green">● Live now</span>}
          {row.status === 'scheduled' && <span className="badge badge-amber">Upcoming</span>}
          {row.status === 'ended' && <span className="badge badge-primary">Ended</span>}
          {row.course && <span className="badge badge-primary">{row.course.title}</span>}
        </div>
        <h1 className="text-3xl font-black text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
          {row.title}
        </h1>
        <p className="text-muted text-sm mb-6">
          {row.tutor?.full_name || 'Tutor'} · {new Date(row.starts_at).toLocaleString()}
        </p>
        {row.description && <p className="text-sm text-muted mb-6">{row.description}</p>}

        {canJoin && row.status === 'live' && jitsiSrc && (
          <div className="glass rounded-2xl overflow-hidden mb-6" style={{ height: '70vh', minHeight: 420 }}>
            <iframe
              title={row.title}
              src={jitsiSrc}
              className="w-full h-full"
              allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
              allowFullScreen
            />
          </div>
        )}

        {canJoin && row.status === 'live' && !jitsiSrc && (
          <div className="glass rounded-2xl p-8 text-center mb-6">
            <p className="text-muted mb-4">This class uses an external meeting link (Zoom / Meet).</p>
            <a href={row.meeting_url} target="_blank" rel="noreferrer" className="btn-primary inline-block">
              Open live class →
            </a>
          </div>
        )}

        {row.status === 'scheduled' && (
          <div className="glass rounded-2xl p-8 text-center mb-6">
            <p className="text-muted mb-2">Class has not started yet.</p>
            <p className="text-sm text-ink font-semibold">
              Starts {new Date(row.starts_at).toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-3">If you miss it, the recording will appear on this page.</p>
          </div>
        )}

        {showRecording && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-ink mb-3" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
              Recorded lecture
            </h2>
            {recording ? (
              <div className="glass rounded-2xl overflow-hidden">
                {recording.kind === 'video' ? (
                  <video src={recording.src} controls className="w-full" style={{ maxHeight: '70vh' }} />
                ) : (
                  <div className="aspect-video bg-black">
                    <iframe
                      title={`${row.title} recording`}
                      src={recording.src}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="glass rounded-2xl p-8 text-center text-muted">
                You missed the live session. The tutor has not uploaded a recording yet — check back soon.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
