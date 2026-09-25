// Inline SVG icon set (24×24, round strokes). No asset files.
import type { ReactNode, SVGProps } from 'react'

const PATHS = {
  cash: <><rect x="3" y="6" width="18" height="12" rx="3" /><circle cx="12" cy="12" r="2.5" /><path d="M6.5 9.5v5M17.5 9.5v5" /></>,
  users: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.2c2.3.1 4 1.6 4.5 4.3" /></>,
  heart: <path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10Z" />,
  hourglass: <><path d="M7 3.5h10M7 20.5h10" /><path d="M8 3.5c0 4.5 4 5.5 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 5.5-4 8.5s4 4 4 8.5" /></>,
  flame: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.3 3.6-8.3.4 1.6 1.2 2.6 2.1 3 .2-2.8 1.5-5 3.3-6.5-.3 3 3.9 5.7 3.9 11.2C18.4 18.4 15.9 21 12 21Z" />,
  magnet: <><path d="M6 4v8a6 6 0 0 0 12 0V4" /><path d="M6 8h3.5M14.5 8H18M9.5 4v8a2.5 2.5 0 0 0 5 0V4" /></>,
  trend: <><path d="M3.5 17.5 9 12l3.5 3.5L20.5 7" /><path d="M15 7h5.5v5.5" /></>,
  pie: <><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12Z" /><path d="M15 3.8A8.5 8.5 0 0 1 20.2 9H15Z" /></>,
  timer: <><circle cx="12" cy="13" r="7.5" /><path d="M12 13V9M9.5 2.5h5M18.5 6.5l1.5-1.5" /></>,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9Z" />,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  leak: <><path d="M5 5h14l-2 11a3 3 0 0 1-3 2.5h-4A3 3 0 0 1 7 16Z" /><path d="M12 18.5v2.5M9 21.5h.01M15 21h.01" /></>,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M14.8 9.2c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2s1.2 1.7 2.8 2.1c1.6.4 2.8.9 2.8 2.1s-1.2 2.1-2.8 2.1c-1.4 0-2.4-.6-2.9-1.5M12 6v1.8M12 16.2V18" /></>,
  megaphone: <><path d="M4 10v4a1 1 0 0 0 1 1h2l8 4.5v-15L7 9H5a1 1 0 0 0-1 1Z" /><path d="M18.5 9.5a3.5 3.5 0 0 1 0 5M8 15l1 4.5" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8.5-8.5M16.5 6.5 19 9M14 9l2 2" /></>,
  scale: <><path d="M12 4v16M7 20h10M5 7h14" /><path d="m5 7-2.5 6a2.8 2.8 0 0 0 5 0Zm14 0-2.5 6a2.8 2.8 0 0 0 5 0Z" /></>,
  branch: <><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="8" r="2.2" /><path d="M6 8.2v7.6M18 10.2c0 4-6 3.5-10.5 6.5" /></>,
  bug: <><rect x="7.5" y="7.5" width="9" height="12" rx="4.5" /><path d="M12 11v8.5M4 13h3.5M16.5 13H20M5 8l2.6 1.6M19 8l-2.6 1.6M5 19l2.8-1.8M19 19l-2.8-1.8M9.5 7.5a2.5 2.5 0 0 1 5 0" /></>,
  network: <><circle cx="12" cy="5.5" r="2.2" /><circle cx="5.5" cy="18" r="2.2" /><circle cx="18.5" cy="18" r="2.2" /><path d="M11 7.5 6.5 16M13 7.5l4.5 8.5M7.7 18h8.6" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4.5c4-2 6 2 10 0l3 .5v9c-3 1.5-6-2.5-10 0l-3 .5" /></>,
  bars: <><path d="M4 20h16" /><rect x="5.5" y="11" width="3" height="7" rx="1" /><rect x="10.5" y="6" width="3" height="12" rx="1" /><rect x="15.5" y="13.5" width="3" height="4.5" rx="1" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>,
  pause: <><rect x="6.5" y="5" width="3.5" height="14" rx="1.2" /><rect x="14" y="5" width="3.5" height="14" rx="1.2" /></>,
  play: <path d="M8 5.5v13l10-6.5Z" />,
  zoomIn: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5M10.5 8v5M8 10.5h5" /></>,
  zoomOut: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5M8 10.5h5" /></>,
  sound: <><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  mute: <><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2 1.2M17.8 15.3l2 1.2M4.2 16.5l2-1.2M17.8 8.7l2-1.2" /><circle cx="12" cy="12" r="6.5" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.3 3.5 5.2 3.5 8.5s-1 6.2-3.5 8.5c-2.5-2.3-3.5-5.2-3.5-8.5s1-6.2 3.5-8.5Z" /></>,
  bag: <><path d="M5 8h14l-1 12H6Z" /><path d="M9 10V6.5a3 3 0 0 1 6 0V10" /></>,
  rocket: <><path d="M12 15.5c-1.5-1.5-3-3.2-3-6.5 0-3 1.5-5.3 3-6.5 1.5 1.2 3 3.5 3 6.5 0 3.3-1.5 5-3 6.5Z" /><circle cx="12" cy="9" r="1.5" /><path d="M9 11.5 6 14l1.5 3.5L9.8 15M15 11.5l3 2.5-1.5 3.5-2.3-2.5M10.5 18.5 12 21l1.5-2.5" /></>,
  growth: <><path d="M4 20h16M4 20V4" /><path d="m7.5 15 3.5-4 3 2.5 5-6" /><path d="M15.5 7.5H19V11" /></>,
  book: <><path d="M5 4.5h10.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2Z" /><path d="M5 18a2 2 0 0 1 2-2h10.5M9 8h5" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2" /></>,
  close: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronUp: <path d="m6 14.5 6-6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  bolt: <path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6Z" />,
  coffee: <><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z" /><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M11 3.5v2.5M14 3.5v2.5" /></>,
  phone: <path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" />,
  sparkle: <path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2Z" />,
  bed: <><path d="M3.5 18.5V7M3.5 14h17v4.5M20.5 14v-2a3 3 0 0 0-3-3H11v5" /><circle cx="7.5" cy="11" r="1.8" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
  chat: <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5Z" />,
  move: <><path d="M12 3v18M3 12h18" /><path d="m9 5.5 3-2.5 3 2.5M9 18.5l3 2.5 3-2.5M5.5 9 3 12l2.5 3M18.5 9l2.5 3-2.5 3" /></>,
  tag: <><path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9Z" /><circle cx="8" cy="8" r="1.5" /></>,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  desk: <><path d="M3 9.5h18M5 9.5V19M19 9.5V19M14 9.5V15h5" /><rect x="8" y="4" width="6" height="4" rx="1" /></>,
  sofa: <><path d="M5 11V8.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V11" /><path d="M3.5 17v-5a1.5 1.5 0 0 1 3 0v1.5h11V12a1.5 1.5 0 0 1 3 0v5ZM6 17v2M18 17v2" /></>,
  door: <><path d="M6 20.5V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16" /><path d="M4 20.5h16M14.5 12.5h.01" /></>,
  warning: <><path d="M12 4 21 19.5H3Z" /><path d="M12 10v4.5M12 17.2h.01" /></>,
  refresh: <><path d="M19.5 7.5A8 8 0 1 0 20 13" /><path d="M20 3.5v4.5h-4.5" /></>,
  handshake: <><path d="m3 10 4-4 5 2 5-2 4 4-4 5-3 3-4-4" /><path d="m8 11 3 3M11 15l2 2M7 14l3 3" /></>,
  unicorn: <><path d="M6 20c0-5 2-9 6-10.5L17.5 3l-1 6.5c2 1.3 3 3.3 3 6v4.5" /><path d="M6 20h13.5M12 9.5c-1.7-1-3.8-.5-5 1" /><circle cx="15" cy="11.5" r=".8" /></>,
  door2: <><rect x="6" y="3.5" width="12" height="17" rx="1.5" /><path d="M14.5 12h.01" /></>,
  save: <><path d="M5 4.5h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z" /><path d="M8 4.5v4.5h7V4.5M8 20.5v-6h8v6" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  keyboard: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M6 12.5h.01M18 12.5h.01M8.5 15h7" /></>,
  camera: <><path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" /><circle cx="12" cy="13" r="3.5" /></>,
  pin: <><path d="M9 3.5h6M10 3.5v5.2L6.5 13h11L14 8.7V3.5" /><path d="M12 13v7.5" /></>,
  building: <><path d="M5 20.5V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15.5M15 9.5h3.5a1 1 0 0 1 1 1v10M3 20.5h18" /><path d="M8 8h1M11 8h1M8 11.5h1M11 11.5h1M8 15h1M11 15h1" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0Z" /><path d="M8 5.5H4.5v1.5A3 3 0 0 0 8 10M16 5.5h3.5v1.5A3 3 0 0 1 16 10M12 13v3.5M8.5 20h7M9.5 20l.5-3.5h4l.5 3.5" /></>,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  logout: <><path d="M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14" /><path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5" /></>,
  cloud: <path d="M7 18.5a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9a4.75 4.75 0 0 1 .5 9.5Z" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 20, className, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}
