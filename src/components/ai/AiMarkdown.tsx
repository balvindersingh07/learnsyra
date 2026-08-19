import { useMemo, type ReactNode } from 'react'

function escapeText(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlight(code: string) {
  return escapeText(code)
    .replace(/(\/\/.*$)/gm, '<span class="ai-cm">$1</span>')
    .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '<span class="ai-str">$&</span>')
    .replace(
      /\b(const|let|var|function|return|import|export|default|from|if|else|new|await|async)\b/g,
      '<span class="ai-kw">$1</span>',
    )
    .replace(/\b(useEffect|useState|useMemo|useRef)\b/g, '<span class="ai-fn">$1</span>')
}

function inlineFmt(text: string) {
  return escapeText(text)
    .replace(
      /`([^`]+)`/g,
      '<code class="px-1 py-0.5 rounded text-[0.85em]" style="background:rgba(108,92,231,0.1);font-family:JetBrains Mono,monospace;color:#5B4BD6">$1</code>',
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

function Inline({ text }: { text: string }) {
  return <span dangerouslySetInnerHTML={{ __html: inlineFmt(text) }} />
}

function TextBlock({
  block,
  onTry,
}: {
  block: string
  onTry?: () => void
}) {
  const nodes: ReactNode[] = []
  const lines = block.split('\n')
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null

  const flushList = () => {
    if (!list) return
    const items = list.items
    const ordered = list.type === 'ol'
    nodes.push(
      ordered ? (
        <ol key={`ol-${nodes.length}`} className="list-decimal pl-5 space-y-1 my-2">
          {items.map((it, i) => (
            <li key={i}><Inline text={it} /></li>
          ))}
        </ol>
      ) : (
        <ul key={`ul-${nodes.length}`} className="list-disc pl-5 space-y-1 my-2">
          {items.map((it, i) => (
            <li key={i}><Inline text={it} /></li>
          ))}
        </ul>
      ),
    )
    list = null
  }

  lines.forEach((line, i) => {
    if (/^(?:\*\*)?Try it yourself →(?:\*\*)?$/.test(line.trim()) && onTry) {
      flushList()
      nodes.push(
        <button key={`try-${i}`} type="button" className="btn-primary text-sm mt-3" onClick={onTry}>
          Try it yourself →
        </button>,
      )
      return
    }
    const ul = line.match(/^\s*[-*]\s+(.+)/)
    const ol = line.match(/^\s*\d+\.\s+(.+)/)
    if (ul) {
      if (!list || list.type !== 'ul') {
        flushList()
        list = { type: 'ul', items: [] }
      }
      list.items.push(ul[1])
      return
    }
    if (ol) {
      if (!list || list.type !== 'ol') {
        flushList()
        list = { type: 'ol', items: [] }
      }
      list.items.push(ol[1])
      return
    }
    flushList()
    if (/^###\s+/.test(line)) {
      nodes.push(<h4 key={i} className="text-sm font-bold text-ink mt-3 mb-1">{line.replace(/^###\s+/, '')}</h4>)
      return
    }
    if (/^##\s+/.test(line)) {
      nodes.push(<h3 key={i} className="text-base font-bold text-ink mt-3 mb-1">{line.replace(/^##\s+/, '')}</h3>)
      return
    }
    if (!line.trim()) {
      nodes.push(<div key={i} className="h-2" />)
      return
    }
    nodes.push(
      <p key={i} className="my-1 leading-relaxed">
        <Inline text={line} />
      </p>,
    )
  })
  flushList()
  return <>{nodes}</>
}

export default function AiMarkdown({
  text,
  onTry,
}: {
  text: string
  onTry?: () => void
}) {
  const parts = useMemo(() => {
    const chunks: { type: 'text' | 'code'; lang?: string; body: string }[] = []
    const re = /```(\w+)?\n([\s\S]*?)```/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      if (m.index > last) chunks.push({ type: 'text', body: text.slice(last, m.index) })
      chunks.push({ type: 'code', lang: m[1] || 'javascript', body: m[2].replace(/\n$/, '') })
      last = m.index + m[0].length
    }
    if (last < text.length) chunks.push({ type: 'text', body: text.slice(last) })
    return chunks
  }, [text])

  return (
    <div className="text-sm text-ink">
      {parts.map((p, i) =>
        p.type === 'code' ? (
          <div key={i} className="ai-code my-3">
            <div
              className="flex items-center justify-between px-3 py-1.5 text-[11px]"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#98A2B3' }}
            >
              <span>{p.lang}</span>
              <button
                type="button"
                className="cursor-pointer"
                style={{ background: 'none', border: 'none', color: '#C4B5FD' }}
                onClick={() => navigator.clipboard.writeText(p.body)}
              >
                Copy
              </button>
            </div>
            <pre className="px-3 py-3 overflow-x-auto m-0">
              <code dangerouslySetInnerHTML={{ __html: highlight(p.body) }} />
            </pre>
          </div>
        ) : (
          <TextBlock key={i} block={p.body} onTry={onTry} />
        ),
      )}
    </div>
  )
}
