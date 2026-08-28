import { SVGProps } from 'react';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'stroke'> {
  size?: number;
  className?: string;
}

const Icon = ({ size = 20, children, className, ...rest }: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round"
    className={className} {...rest}
  >
    {children}
  </svg>
);

export const IconDashboard  = (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Icon>;
export const IconBatches    = (p: IconProps) => <Icon {...p}><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="m3 8 9 5v8" /><path d="M21 8v8l-9 5" /></Icon>;
export const IconLots       = (p: IconProps) => <Icon {...p}><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" /><path d="M7 7h.01" /></Icon>;
export const IconRecall     = (p: IconProps) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6" /><path d="M12 8v4l3 3" /></Icon>;
export const IconReports    = (p: IconProps) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8M16 17H8M10 9H8" /></Icon>;
export const IconRecipes    = (p: IconProps) => <Icon {...p}><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" /></Icon>;
export const IconMachines   = (p: IconProps) => <Icon {...p}><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" /><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></Icon>;
export const IconAdmin      = (p: IconProps) => <Icon {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>;

export const IconChevronLeft  = (p: IconProps) => <Icon {...p}><path d="m15 18-6-6 6-6" /></Icon>;
export const IconChevronRight = (p: IconProps) => <Icon {...p}><path d="m9 18 6-6-6-6" /></Icon>;
export const IconChevronDown  = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
export const IconArrowUp      = (p: IconProps) => <Icon {...p}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>;
export const IconArrowDown    = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12l7 7 7-7" /></Icon>;
export const IconExternal     = (p: IconProps) => <Icon {...p}><path d="M7 17 17 7" /><path d="M7 7h10v10" /></Icon>;
export const IconClose        = (p: IconProps) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
export const IconAlert        = (p: IconProps) => <Icon {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4M12 17h.01" /></Icon>;
export const IconBell         = (p: IconProps) => <Icon {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></Icon>;
export const IconSearch       = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>;
export const IconFilter       = (p: IconProps) => <Icon {...p}><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></Icon>;
export const IconDots         = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></Icon>;
export const IconRefresh      = (p: IconProps) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6" /></Icon>;
export const IconInfo         = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Icon>;
export const IconWarn         = IconAlert;
export const IconCritical     = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></Icon>;
export const IconCheck        = (p: IconProps) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>;
export const IconUser         = (p: IconProps) => <Icon {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>;
export const IconCalendar     = (p: IconProps) => <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>;
export const IconPlus         = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const IconPause        = (p: IconProps) => <Icon {...p}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></Icon>;
export const IconRotate       = (p: IconProps) => <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6" /></Icon>;
export const IconTrash        = (p: IconProps) => <Icon {...p}><path d="M3 6h18M19 6l-1 14H6L5 6M10 6V4h4v2" /></Icon>;
export const IconClipboard    = (p: IconProps) => <Icon {...p}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></Icon>;
export const IconActivity     = (p: IconProps) => <Icon {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Icon>;
export const IconQR           = (p: IconProps) => <Icon {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="5" y="5" width="3" height="3" fill="currentColor" /><rect x="16" y="5" width="3" height="3" fill="currentColor" /><rect x="5" y="16" width="3" height="3" fill="currentColor" /><path d="M14 14h3v3M21 14v3M14 21h3M21 21v-3" /></Icon>;
export const IconFlash        = (p: IconProps) => <Icon {...p}><path d="m13 2-3 7h6l-7 13 1-9H4l5-9 4-2Z" /></Icon>;
export const IconShield       = (p: IconProps) => <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></Icon>;
export const IconMapPin       = (p: IconProps) => <Icon {...p}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Icon>;
export const IconLock         = (p: IconProps) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Icon>;
export const IconLink         = (p: IconProps) => <Icon {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Icon>;
export const IconX            = (p: IconProps) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
export const IconMaterials    = (p: IconProps) => <Icon {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.29 7 12 12 20.71 7" /><line x1="12" y1="22" x2="12" y2="12" /></Icon>;
export const IconEdit         = (p: IconProps) => <Icon {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></Icon>;
export const IconTag          = (p: IconProps) => <Icon {...p}><path d="M20.59 13.41 13 21l-9-9V4h8l8.59 8.59a2 2 0 0 1 0 2.82Z" /><path d="M7.5 7.5h.01" /></Icon>;
export const IconBox          = (p: IconProps) => <Icon {...p}><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="m3 8 9 5v8" /><path d="M21 8v8l-9 5" /></Icon>;
export const IconBattery      = (p: IconProps) => <Icon {...p}><rect x="2" y="7" width="16" height="10" rx="2" /><path d="M22 11v2" /><path d="M6 10v4M9 10v4M12 10v4" /></Icon>;
export const IconPrint        = (p: IconProps) => <Icon {...p}><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></Icon>;
export const IconLogOut       = (p: IconProps) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></Icon>;
export const IconCamera       = (p: IconProps) => <Icon {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></Icon>;
export const IconDownload     = (p: IconProps) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></Icon>;
