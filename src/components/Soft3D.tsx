interface OrbProps {
  emoji: string
  size?: number
  className?: string
}

export function Orb3D({ emoji, size = 56, className = '' }: OrbProps) {
  return (
    <div
      className={`orb-3d ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {emoji}
    </div>
  )
}

export function BlobField() {
  return (
    <>
      <div className="blob float" style={{ width: 220, height: 220, background: '#C9C0FF', top: 40, right: 40 }} />
      <div className="blob float2" style={{ width: 160, height: 160, background: '#B8E8F0', bottom: 60, left: 20 }} />
      <div className="blob float3" style={{ width: 120, height: 120, background: '#D6E4FF', top: 180, left: '42%' }} />
    </>
  )
}

export default Orb3D
