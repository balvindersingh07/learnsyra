import { useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M10.6 10.7a3 3 0 0 0 3.7 3.7M6.5 6.8C4.3 8.2 2.8 10.3 2 12c1.2 2.4 4.5 7 10 7 1.8 0 3.4-.4 4.8-1.1M9.9 5.2C10.6 5.1 11.3 5 12 5c5.5 0 8.8 4.6 10 7-.4.8-1 1.8-1.8 2.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function PasswordField({ className, style, ...props }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative w-full">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={className}
        style={{ ...style, paddingRight: '2.75rem' }}
      />
      <button
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer p-0 m-0 leading-none flex items-center justify-center"
        style={{ background: 'none', border: 'none', color: '#667085' }}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}
