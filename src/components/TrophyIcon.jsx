export default function TrophyIcon({ size = 200 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 0 30px rgba(201,168,76,0.4))' }}
    >
      {/* Glow base */}
      <ellipse cx="100" cy="210" rx="50" ry="8" fill="url(#glowBase)" opacity="0.5" />

      {/* Base platform */}
      <rect x="60" y="195" width="80" height="8" rx="2" fill="url(#goldGrad)" />
      <rect x="70" y="188" width="60" height="10" rx="1" fill="url(#goldGrad)" />

      {/* Stem */}
      <rect x="88" y="158" width="24" height="32" fill="url(#goldGrad)" />
      <rect x="84" y="155" width="32" height="6" rx="1" fill="url(#goldGradBright)" />

      {/* Cup body */}
      <path
        d="M55 55 Q50 120 88 155 L112 155 Q150 120 145 55 Z"
        fill="url(#cupGrad)"
      />

      {/* Cup inner shadow */}
      <path
        d="M65 60 Q62 115 95 150 L105 150 Q138 115 135 60 Z"
        fill="url(#cupInner)"
        opacity="0.3"
      />

      {/* Cup highlight */}
      <path
        d="M70 65 Q68 100 80 130"
        stroke="url(#highlightGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Left handle */}
      <path
        d="M55 65 Q25 65 25 95 Q25 120 55 120"
        stroke="url(#goldGrad)"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M55 70 Q32 70 32 95 Q32 115 55 115"
        stroke="url(#goldGradBright)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />

      {/* Right handle */}
      <path
        d="M145 65 Q175 65 175 95 Q175 120 145 120"
        stroke="url(#goldGrad)"
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M145 70 Q168 70 168 95 Q168 115 145 115"
        stroke="url(#goldGradBright)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />

      {/* Cup rim */}
      <ellipse cx="100" cy="55" rx="45" ry="10" fill="url(#goldGradBright)" />
      <ellipse cx="100" cy="53" rx="40" ry="7" fill="url(#cupInner)" opacity="0.4" />

      {/* Star emblem */}
      <path
        d="M100 80 L104 93 L118 93 L107 101 L111 114 L100 106 L89 114 L93 101 L82 93 L96 93 Z"
        fill="url(#goldGradBright)"
        opacity="0.9"
      />

      {/* Decorative lines */}
      <line x1="65" y1="100" x2="135" y2="100" stroke="url(#goldGradBright)" strokeWidth="0.5" opacity="0.3" />
      <line x1="60" y1="110" x2="140" y2="110" stroke="url(#goldGradBright)" strokeWidth="0.5" opacity="0.2" />

      <defs>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8A6F2E" />
          <stop offset="40%" stopColor="#C9A84C" />
          <stop offset="70%" stopColor="#E8C46A" />
          <stop offset="100%" stopColor="#8A6F2E" />
        </linearGradient>
        <linearGradient id="goldGradBright" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C9A84C" />
          <stop offset="50%" stopColor="#F5E4B3" />
          <stop offset="100%" stopColor="#C9A84C" />
        </linearGradient>
        <linearGradient id="cupGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7A5520" />
          <stop offset="30%" stopColor="#C9A84C" />
          <stop offset="60%" stopColor="#E8C46A" />
          <stop offset="100%" stopColor="#6B3D10" />
        </linearGradient>
        <linearGradient id="cupInner" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000000" />
          <stop offset="100%" stopColor="#C9A84C" />
        </linearGradient>
        <linearGradient id="highlightGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5E4B3" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <radialGradient id="glowBase" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#C9A84C" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
    </svg>
  )
}
