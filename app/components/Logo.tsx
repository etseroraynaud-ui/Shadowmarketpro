export function LogoSVG({ className = "logo-svg" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="qg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4"/>
          <stop offset="50%" stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#6366f1"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="cb"/>
          <feMerge>
            <feMergeNode in="cb"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="46" stroke="url(#qg)" strokeWidth="2" fill="none" opacity=".25"/>
      <g filter="url(#glow)">
        <rect x="18" y="45" width="6" height="30" fill="#06b6d4" opacity=".7" rx="1"/>
        <rect x="28" y="35" width="6" height="40" fill="#06b6d4" opacity=".8" rx="1"/>
        <rect x="38" y="28" width="6" height="47" fill="#3b82f6" opacity=".9" rx="1"/>
        <rect x="48" y="20" width="6" height="55" fill="#3b82f6" rx="1"/>
        <rect x="58" y="32" width="6" height="43" fill="#6366f1" opacity=".9" rx="1"/>
        <rect x="68" y="38" width="6" height="37" fill="#8b5cf6" opacity=".8" rx="1"/>
        <rect x="78" y="42" width="6" height="33" fill="#8b5cf6" opacity=".7" rx="1"/>
      </g>
      <g filter="url(#glow)">
        <path d="M21 50L31 40L41 33L51 25L61 37L71 43L81 47" stroke="url(#qg)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="51" cy="25" r="3" fill="#3b82f6"/>
        <circle cx="21" cy="50" r="2" fill="#06b6d4" opacity=".8"/>
        <circle cx="81" cy="47" r="2" fill="#8b5cf6" opacity=".8"/>
      </g>
      <g opacity=".15" stroke="url(#qg)" strokeWidth=".5">
        <line x1="15" y1="30" x2="85" y2="30" strokeDasharray="2 2"/>
        <line x1="15" y1="45" x2="85" y2="45" strokeDasharray="2 2"/>
        <line x1="15" y1="60" x2="85" y2="60" strokeDasharray="2 2"/>
      </g>
      <g stroke="url(#qg)" strokeWidth="1.5" opacity=".3">
        <path d="M50 8L78 22L78 78L50 92L22 78L22 22Z" fill="none" strokeDasharray="4 3"/>
      </g>
      <g stroke="url(#qg)" strokeWidth="2.5" strokeLinecap="round" opacity=".6">
        <path d="M8 8L8 18M8 8L18 8"/>
        <path d="M92 8L92 18M92 8L82 8"/>
        <path d="M8 92L8 82M8 92L18 92"/>
        <path d="M92 92L92 82M92 92L82 92"/>
      </g>
      <text x="50" y="20" textAnchor="middle" fill="url(#qg)" fontSize="14" fontWeight="bold" opacity=".4">Σ</text>
    </svg>
  )
}

export function LogoSVGSmall({ className = "logo-svg" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width="32" height="32" fill="none" className={className}>
      <defs>
        <linearGradient id="qgf" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4"/>
          <stop offset="50%" stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#6366f1"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" stroke="url(#qgf)" strokeWidth="2" fill="none" opacity=".3"/>
      <g>
        <rect x="22" y="45" width="5" height="25" fill="#06b6d4" opacity=".7" rx="1"/>
        <rect x="32" y="37" width="5" height="33" fill="#06b6d4" opacity=".8" rx="1"/>
        <rect x="42" y="30" width="5" height="40" fill="#3b82f6" opacity=".9" rx="1"/>
        <rect x="52" y="23" width="5" height="47" fill="#3b82f6" rx="1"/>
        <rect x="62" y="34" width="5" height="36" fill="#6366f1" opacity=".9" rx="1"/>
        <rect x="72" y="40" width="5" height="30" fill="#8b5cf6" opacity=".8" rx="1"/>
      </g>
      <path d="M24 50L34 42L44 34L54 27L64 38L74 44" stroke="url(#qgf)" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export function LogoSVGNav() {
  return (
    <svg className="logo-svg" style={{ width: 36, height: 36, flexShrink: 0 }} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="qg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4"/>
          <stop offset="50%" stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#6366f1"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" stroke="url(#qg2)" strokeWidth="2" fill="none" opacity=".25"/>
      <g>
        <rect x="18" y="45" width="6" height="30" fill="#06b6d4" opacity=".7" rx="1"/>
        <rect x="28" y="35" width="6" height="40" fill="#06b6d4" opacity=".8" rx="1"/>
        <rect x="38" y="28" width="6" height="47" fill="#3b82f6" opacity=".9" rx="1"/>
        <rect x="48" y="20" width="6" height="55" fill="#3b82f6" rx="1"/>
        <rect x="58" y="32" width="6" height="43" fill="#6366f1" opacity=".9" rx="1"/>
        <rect x="68" y="38" width="6" height="37" fill="#8b5cf6" opacity=".8" rx="1"/>
        <rect x="78" y="42" width="6" height="33" fill="#8b5cf6" opacity=".7" rx="1"/>
      </g>
      <path d="M21 50L31 40L41 33L51 25L61 37L71 43L81 47" stroke="url(#qg2)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="51" cy="25" r="3" fill="#3b82f6"/>
      <circle cx="21" cy="50" r="2" fill="#06b6d4" opacity=".8"/>
      <circle cx="81" cy="47" r="2" fill="#8b5cf6" opacity=".8"/>
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
    </svg>
  )
}
