interface Props {
  topic: string
  onFindTutor: () => void
  compact?: boolean
}

export default function TutorHandoff({ topic, onFindTutor, compact }: Props) {
  return (
    <div
      className="glass rounded-2xl p-4"
      style={{ borderColor: 'rgba(108,92,231,0.2)', borderWidth: 1 }}
    >
      <div className="text-sm font-bold text-ink mb-1" style={{ fontFamily: 'Plus Jakarta Sans,sans-serif' }}>
        👨‍🏫 Still stuck?
      </div>
      <p className="text-xs text-muted leading-relaxed mb-3">
        I can connect you with a tutor who specializes in {topic}.
      </p>
      <button className={compact ? 'btn-primary text-xs px-3 py-1.5' : 'btn-primary text-sm'} onClick={onFindTutor}>
        Find a Tutor →
      </button>
    </div>
  )
}
