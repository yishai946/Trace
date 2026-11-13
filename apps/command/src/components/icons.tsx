import type { ReportType } from '@trace/domain';

// Line icons for the profile menu and the "עוד" page, drawn like the rest of Trace Console's icons (24 grid, 1.8 stroke).

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export const SunIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = () => (
  <svg {...base}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);

export const MonitorIcon = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </svg>
);

export const SignOutIcon = () => (
  <svg {...base}>
    <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />
  </svg>
);

export const ChevronIcon = () => (
  <svg {...base}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const MissionsListIcon = () => (
  <svg {...base}>
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);

export const PhoneIcon = () => (
  <svg {...base}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const CheckIcon = () => (
  <svg {...base}>
    <path d="m5 12 5 5 9-10" />
  </svg>
);

export const InfoIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5h.01" />
  </svg>
);

/** The glyph of a report category (wireframe Cd10): a diamond, a triangle, a lock, an info circle, a flag. */
export function ReportTypeIcon({ type }: { type: ReportType }) {
  return <svg {...base}>{REPORT_TYPE_PATHS[type]}</svg>;
}

const REPORT_TYPE_PATHS: Record<ReportType, React.ReactNode> = {
  finding: <path d="M12 3l9 9-9 9-9-9z" />,
  hazard: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18h.01" />
    </>
  ),
  inaccessible: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  general: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5h.01" />
    </>
  ),
  located: <path d="M6 21V4M6 4h11l-2.5 4L17 12H6" />,
};
