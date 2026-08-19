import { initials } from '../../lib/tutorMarketplace'

export default function TutorAvatar({
  name,
  src,
  size = 64,
}: {
  name: string
  src?: string | null
  size?: number
}) {
  return (
    <div
      className="tutor-avatar rounded-2xl flex items-center justify-center text-white font-black flex-shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        fontSize: size > 72 ? 28 : 16,
        background: 'linear-gradient(135deg, #6C5CE7, #22C7D6)',
        fontFamily: 'Plus Jakarta Sans,sans-serif',
      }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : initials(name)}
    </div>
  )
}
