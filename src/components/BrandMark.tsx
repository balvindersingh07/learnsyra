import logoUrl from '../assets/logo.png'

interface Props {
  size?: number
  withWordmark?: boolean
  wordmarkClass?: string
  className?: string
}

export default function BrandMark({ size = 36, withWordmark = false, wordmarkClass = '', className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={logoUrl}
        alt="LearnSyra"
        width={size}
        height={size}
        className="object-contain flex-shrink-0"
        style={{
          width: size,
          height: size,
          filter: 'drop-shadow(0 8px 16px rgba(108,92,231,0.22))',
        }}
      />
      {withWordmark && (
        <span
          className={`text-ink font-bold ${wordmarkClass}`}
          style={{ fontFamily: 'Plus Jakarta Sans,sans-serif', letterSpacing: '-0.02em' }}
        >
          Learn<span className="gradient-text">Syra</span>
        </span>
      )}
    </span>
  )
}
