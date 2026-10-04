/** Quill mark: a fountain-pen nib leaving a drop of ink. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="mark">
      <defs>
        <linearGradient id="qInk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fb6df" />
          <stop offset="1" stopColor="#24597f" />
        </linearGradient>
      </defs>
      {/* ink stroke the nib just wrote */}
      <path d="M5 33.5c3.6-1.2 6.4-.4 9.4.7 2.9 1.1 5.8 1.7 9.1.3" fill="none" stroke="url(#qInk)" strokeWidth="2.4" strokeLinecap="round" />
      {/* the nib, tilted like it is writing */}
      <g transform="rotate(38 22 16)">
        <path d="M22 1.5c4.6 3.2 7.6 8 7.6 13.2 0 2.2-.6 4-1.6 5.6L22 30.5l-6-10.2c-1-1.6-1.6-3.4-1.6-5.6 0-5.2 3-10 7.6-13.2Z" fill="#0e1116" />
        <path d="M22 13.6V30" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="22" cy="12.4" r="2.1" fill="#fff" />
        <path d="M16.6 6.4h10.8" stroke="#fff" strokeOpacity=".22" strokeWidth="1" />
      </g>
      {/* the drop of ink at the tip */}
      <path d="M11.2 24.4c1.6 2 2.6 3.5 2.6 4.8a2.6 2.6 0 0 1-5.2 0c0-1.3 1-2.8 2.6-4.8Z" fill="url(#qInk)" />
    </svg>
  );
}

export function Logo() {
  return (
    <a className="logo" href="/" aria-label="Quill home">
      <Mark />
      <span>Quill</span>
    </a>
  );
}
