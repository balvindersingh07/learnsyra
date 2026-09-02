import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  groupSearchResults,
  MIN_QUERY_LENGTH,
  runGlobalSearch,
  SEARCH_DEBOUNCE_MS,
  type GlobalSearchResult,
} from '../lib/globalSearch'
import type { UserRole } from '../lib/supabase'
import './global-search.css'

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  )
}

export default function GlobalSearch({ role }: { role: UserRole | null | undefined }) {
  const navigate = useNavigate()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<GlobalSearchResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  const flatResults = useMemo(() => results, [results])
  const groups = useMemo(() => groupSearchResults(flatResults), [flatResults])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setError(null)
    setActiveIndex(0)
    setLoading(false)
  }, [])

  const openSearch = useCallback(() => {
    setOpen(true)
  }, [])

  const pick = useCallback((item: GlobalSearchResult) => {
    close()
    navigate(item.href)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [close, navigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (!flatResults.length) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => Math.min(flatResults.length - 1, i + 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => Math.max(0, i - 1))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = flatResults[activeIndex]
        if (item) pick(item)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flatResults, activeIndex, close, pick])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([])
      setError(null)
      setLoading(false)
      setActiveIndex(0)
      return
    }

    setLoading(true)
    let cancelled = false
    const timer = window.setTimeout(() => {
      runGlobalSearch(q, role)
        .then(payload => {
          if (cancelled) return
          setResults(payload.results)
          setError(payload.error)
          setActiveIndex(0)
        })
        .catch(() => {
          if (cancelled) return
          setResults([])
          setError('Search is temporarily unavailable. Try again.')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, query, role])

  let body: ReactNode
  if (query.trim().length < MIN_QUERY_LENGTH) {
    body = <p className="gs-empty">Type at least {MIN_QUERY_LENGTH} characters to search courses, tutors, projects, and pages.</p>
  } else if (loading) {
    body = <p className="gs-empty">Searching…</p>
  } else if (error) {
    body = <p className="gs-empty" style={{ color: '#e11d48' }}>{error}</p>
  } else if (!flatResults.length) {
    body = <p className="gs-empty">No results for “{query.trim()}”.</p>
  } else {
    let index = -1
    body = groups.map(group => (
      <section key={group.category}>
        <div className="gs-group-label">{group.label}</div>
        {group.items.map(item => {
          index += 1
          const current = index
          return (
            <button
              key={item.id}
              type="button"
              className="gs-item"
              data-active={current === activeIndex}
              onMouseEnter={() => setActiveIndex(current)}
              onClick={() => pick(item)}
            >
              <div className="gs-item-title">{item.title}</div>
              {item.subtitle && <div className="gs-item-sub">{item.subtitle}</div>}
            </button>
          )
        })}
      </section>
    ))
  }

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        aria-label="Open global search"
        className="w-8 h-8 items-center justify-center rounded-lg cursor-pointer flex"
        style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.12)', color: '#667085' }}
      >
        <SearchIcon />
      </button>

      {open && createPortal(
        <div className="gs-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
          <div className="gs-panel glass rounded-2xl" role="dialog" aria-modal="true" aria-labelledby={inputId} onMouseDown={e => e.stopPropagation()}>
            <div className="gs-input-wrap">
              <SearchIcon />
              <input
                id={inputId}
                ref={inputRef}
                className="field flex-1 px-3 py-2 text-sm"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search LearnSyra…"
                aria-label="Search LearnSyra"
                autoComplete="off"
              />
              <button type="button" className="btn-glass text-xs" onClick={close}>Esc</button>
            </div>
            <div className="gs-results">{body}</div>
            <div className="gs-footer">↑↓ navigate · Enter open · Esc close · Ctrl/Cmd+K anytime</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
