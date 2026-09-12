import type { SVGProps } from "react";

/**
 * Line-icon set. Stroke = currentColor, 1.6px, 24px grid.
 * Use: <Icon name="wallet" className="size-5 text-muted" />
 */

export type IconName =
  | "home"
  | "wallet"
  | "receipt"
  | "shield"
  | "shieldCheck"
  | "cube"
  | "ticket"
  | "bell"
  | "settings"
  | "search"
  | "plus"
  | "minus"
  | "arrowUp"
  | "arrowDown"
  | "arrowRight"
  | "download"
  | "filter"
  | "truck"
  | "check"
  | "chevronRight"
  | "chevronDown"
  | "logout"
  | "gauge"
  | "users"
  | "inbox"
  | "file"
  | "barChart"
  | "lock"
  | "dots"
  | "calendar"
  | "external"
  | "paperclip"
  | "ban"
  | "eye"
  | "google";

const paths: Record<IconName, React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5M6 10v9h12v-9" />,
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M16.5 14.5h.01" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3v-17Z" />
      <path d="M9 8h6M9 11.5h6" />
    </>
  ),
  shield: <path d="M12 3.5 19 6v5c0 4.4-3 7.6-7 9.5-4-1.9-7-5.1-7-9.5V6l7-2.5Z" />,
  shieldCheck: (
    <>
      <path d="M12 3.5 19 6v5c0 4.4-3 7.6-7 9.5-4-1.9-7-5.1-7-9.5V6l7-2.5Z" />
      <path d="m9 11.5 2 2 4-4" />
    </>
  ),
  cube: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 12h16M12 4v16" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z" />
      <path d="M14 6v12" strokeDasharray="2 2" />
    </>
  ),
  bell: <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />,
  truck: (
    <>
      <path d="M2 6.5h11v9H2zM13 9.5h4l3 3v3h-7z" />
      <circle cx="6" cy="17.5" r="1.6" />
      <circle cx="17" cy="17.5" r="1.6" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  logout: <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 12h9M16 9l3 3-3 3" />,
  gauge: (
    <>
      <path d="M4 18a8 8 0 1 1 16 0" />
      <path d="m12 14 4-4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5M17 19a6 6 0 0 0-2-4.4" />
    </>
  ),
  inbox: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 14h5a2 2 0 0 0 4 0h0a2 2 0 0 0 4 0h5" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 13h6M9 16.5h6" />
    </>
  ),
  barChart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  paperclip: <path d="M20 11.5 12 19a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5" />,
  ban: <path d="M5.6 5.6 18.4 18.4M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />,
  eye: <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  google: null, // rendered specially below
};

export function Icon({
  name,
  className,
  ...rest
}: { name: IconName; className?: string } & SVGProps<SVGSVGElement>) {
  if (name === "google") return <GoogleMark className={className} />;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}

/** Full-colour Google "G" for the OAuth button. */
export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.6h11.9c-.2 2-1.5 5-4.4 7l-.04.3 6.4 5 .4.04c4.1-3.8 6.5-9.3 6.5-15.9Z" />
      <path fill="#34A853" d="M24 46c5.8 0 10.7-1.9 14.3-5.2l-6.8-5.3c-1.8 1.3-4.3 2.2-7.5 2.2-5.7 0-10.6-3.8-12.3-9.1l-.3.02-6.6 5.1-.1.3C8.3 41.1 15.6 46 24 46Z" />
      <path fill="#FBBC05" d="M11.7 28.6A13.5 13.5 0 0 1 11 24c0-1.6.3-3.2.7-4.6l-.02-.3-6.7-5.2-.2.1A22 22 0 0 0 2 24c0 3.6.9 7 2.4 10l7.3-5.4Z" />
      <path fill="#EB4335" d="M24 9.5c4 0 6.8 1.7 8.3 3.2l6.1-5.9C34.7 3.4 29.8 1.5 24 1.5 15.6 1.5 8.3 6.4 4.4 13.5l7.3 5.4C13.4 13.3 18.3 9.5 24 9.5Z" />
    </svg>
  );
}
