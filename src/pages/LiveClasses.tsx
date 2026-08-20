import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getLiveClasses,
  getMyLiveAttendance,
  type LiveClass,
} from '../lib/api'
import { liveClassPath } from '../lib/paths'
import {
  markSessionComplete,
  markSessionLive,
  resolveLiveSession,
  secondsUntil,
  type LivePhase,
  type LiveSessionRecord,
} from '../lib/liveSession'
import { buildTutorCatalog, getTutorById } from '../lib/tutorMarketplace'
import LiveLobby from '../components/live/LiveLobby'
import LiveWorkspace from '../components/live/LiveWorkspace'
import LiveSummary from '../components/live/LiveSummary'
import './live-session.css'

function when(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function StatusBadge({ status }: { status: LiveClass['status'] }) {
  if (status === 'live') return <span className="badge badge-green">● Live now</span>
  if (status === 'scheduled') return <span className="badge badge-amber">Upcoming</span>
  return <span className="badge badge-primary">Recording</span>
}

export default function LiveClasses() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [rows, setRows] = useState<LiveClass[]>([])
  const [attended, setAttended] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'live' | 'upcoming' | 'recordings'>('live')
  const [error, setError] = useState<string | null>(null)
  const [record, setRecord] = useState<LiveSessionRecord | null>(() => resolveLiveSession(params.get('session')))
  const [view, setView] = useState<LivePhase>(() => (record?.phase === 'live' ? 'live' : 'lobby'))

  const catalog = useMemo(() => buildTutorCatalog([]), [])
  const tutor = record ? getTutorById(catalog, record.tutorId) : null

  useEffect(() => {
    const next = resolveLiveSession(params.get('session'))
    setRecord(next)
    if (!next) {
      setView('lobby')
      return
    }
    if (next.phase === 'live') setView('live')
    else if (params.get('join') === '1' && secondsUntil(next.scheduledAt) <= 0 && next.status !== 'completed') {
      setRecord(markSessionLive(next))
      setView('live')
    } else {
      setView(next.phase === 'summary' ? 'summary' : 'lobby')
    }
  }, [params])

  useEffect(() => {
    Promise.all([getLiveClasses(), getMyLiveAttendance()])
      .then(([list, ids]) => {
        setRows(list)
        setAttended(new Set(ids))
        if (list.some(c => c.status === 'live')) setTab('live')
        else if (list.some(c => c.status === 'scheduled')) setTab('upcoming')
        else setTab('recordings')
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load live classes'))
  }, [])

  const live = useMemo(() => rows.filter(c => c.status === 'live'), [rows])
  const upcoming = useMemo(() => rows.filter(c => c.status === 'scheduled'), [rows])
  const recordings = useMemo(
    () => rows.filter(c => c.status === 'ended' || Boolean(c.recording_url)),
    [rows],
  )
  const shown = tab === 'live' ? live : tab === 'upcoming' ? upcoming : recordings

  if (record && tutor && (view === 'live' || view === 'connecting')) {
    return (
      <LiveWorkspace
        record={record}
        tutor={tutor}
        onChange={setRecord}
        onLeave={() => {
          setRecord(markSessionComplete(record))
          setView('summary')
        }}
      />
    )
  }

  if (record && tutor && view === 'summary') {
    return <LiveSummary record={record} tutor={tutor} onChange={setRecord} />
  }

  return (
    <div className="pt-20 px-6 pb-16 max-w-5xl mx-auto overflow-x-hidden">
      {record && tutor ? (
        <>
          <LiveLobby
            record={record}
            tutor={tutor}
            onJoin={() => {
              setRecord(markSessionLive(record))
              setView('live')
            }}
          />
          {record.status === 'completed' && (
            <div className="glass rounded-2xl p-4 mb-8 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted">Your last 1-on-1 session is saved.</div>
              <button type="button" className="btn-glass text-sm" onClick={() => setView('summary')}>
                Open summary
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="glass rounded-2xl p-8 mb-8 text-center">
          <h2 className="text-xl font-bold text-ink mb-2" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
            No live sessions yet
          </h2>
          <p className="text-sm text-muted mb-4">Book a tutor session to get started.</p>
          <button type="button" className="btn-primary text-sm" onClick={() => navigate('/tutors')}>
            Find a Tutor →
          </button>
        </div>
      )}

      <h2
        className="text-2xl font-black text-ink mb-2"
        style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
      >
        Live <span className="gradient-text">Classes</span>
      </h2>
      <p className="text-muted mb-6">
        Group classes stay here. Join when a tutor goes live, or watch the recording.
      </p>

      {error && <div className="glass rounded-2xl p-4 mb-4 text-rose-500 text-sm">{error}</div>}

      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          ['live', `Live now (${live.length})`],
          ['upcoming', `Upcoming (${upcoming.length})`],
          ['recordings', `Recordings (${recordings.length})`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
            style={{
              fontFamily: 'Plus Jakarta Sans,sans-serif',
              background: tab === id ? 'rgba(108,92,231,0.2)' : 'rgba(255,255,255,0.9)',
              border: `1px solid ${tab === id ? 'rgba(108,92,231,0.4)' : 'rgba(99,102,241,0.12)'}`,
              color: tab === id ? '#6C5CE7' : '#667085',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center text-muted">
          {tab === 'live' && 'No class is live right now. Check upcoming or recordings.'}
          {tab === 'upcoming' && 'No upcoming live classes. Your tutor can start one from their dashboard.'}
          {tab === 'recordings' && 'No recordings yet. After a live class ends, the tutor uploads a replay here.'}
        </div>
      )}

      <div className="space-y-3">
        {shown.map(c => {
          const missed = c.status === 'ended' && !attended.has(c.id)
          return (
            <div key={c.id} className="glass rounded-2xl p-5 flex flex-wrap items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: c.status === 'live' ? 'rgba(32,201,151,0.18)' : 'rgba(108,92,231,0.12)' }}
              >
                {c.status === 'ended' ? '▶' : '📡'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-base font-bold text-ink" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
                    {c.title}
                  </span>
                  <StatusBadge status={c.status} />
                  {missed && <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>You missed this</span>}
                </div>
                <div className="text-sm text-muted">
                  {c.tutor?.full_name || 'Tutor'}
                  {c.course ? ` · ${c.course.title}` : ''}
                  {' · '}
                  {when(c.starts_at)}
                </div>
                {c.description && <p className="text-xs text-muted mt-1">{c.description}</p>}
              </div>
              <button
                className="btn-primary text-sm"
                onClick={() => navigate(liveClassPath(c.id))}
              >
                {c.status === 'live' ? 'Join live →' : c.recording_url ? 'Watch recording →' : c.status === 'ended' ? 'Open class' : 'View'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
