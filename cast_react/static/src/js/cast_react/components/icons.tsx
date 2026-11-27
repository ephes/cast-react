// The handful of icons the theme needs, drawn inline so there is no icon font
// or sprite to download.

import type { ReactNode } from "react";

function Icon({ children, size = 20, filled = false }: { children: ReactNode; size?: number; filled?: boolean }) {
  return (
    <svg
      className="cr-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type IconProps = { size?: number };

export const PlayIcon = ({ size }: IconProps) => (
  <Icon size={size} filled>
    <path d="M8 5.2v13.6a.8.8 0 0 0 1.22.68l10.9-6.8a.8.8 0 0 0 0-1.36L9.22 4.52A.8.8 0 0 0 8 5.2z" />
  </Icon>
);

export const PauseIcon = ({ size }: IconProps) => (
  <Icon size={size} filled>
    <rect x="6.5" y="5" width="4" height="14" rx="1" />
    <rect x="13.5" y="5" width="4" height="14" rx="1" />
  </Icon>
);

export const BackIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M4 5v5h5" />
    <path d="M4.6 14.5a8 8 0 1 0 1.6-7.2L4 10" />
  </Icon>
);

export const ForwardIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M20 5v5h-5" />
    <path d="M19.4 14.5a8 8 0 1 1-1.6-7.2L20 10" />
  </Icon>
);

export const VolumeIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6" />
    <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Icon>
);

export const MutedIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </Icon>
);

export const LinkIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);

export const CloseIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const SearchIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Icon>
);

export const ChevronLeftIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M14.5 6l-6 6 6 6" />
  </Icon>
);

export const ChevronRightIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M9.5 6l6 6-6 6" />
  </Icon>
);

export const SunIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </Icon>
);

export const MoonIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Icon>
);

export const AutoIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4v16a8 8 0 0 0 0-16z" fill="currentColor" stroke="none" />
  </Icon>
);

export const FeedIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M5 11a8 8 0 0 1 8 8" />
    <path d="M5 5a14 14 0 0 1 14 14" />
    <circle cx="6" cy="18" r="1.2" fill="currentColor" />
  </Icon>
);

export const FilterIcon = ({ size }: IconProps) => (
  <Icon size={size}>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </Icon>
);
