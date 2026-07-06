export const HUB_API_URL =
  process.env['NEXT_PUBLIC_HUB_API_URL'] ??
  process.env['HUB_API_URL'] ??
  'http://localhost:3001';

export const POLL_INTERVAL_MS  = 15_000;   // 15 s — live status polling
export const HEALTH_POLL_MS    = 10_000;   // 10 s — health monitor
export const LOG_POLL_MS       = 5_000;    //  5 s — log tail

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN:       'Admin',
  OPERATOR:    'Operator',
  READ_ONLY:   'Read Only',
};

export const STATUS_COLORS = {
  // Connector / Agent / Sync
  RUNNING:     { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  ONLINE:      { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  SUCCESS:     { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  STOPPED:     { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
  DISABLED:    { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
  OFFLINE:     { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
  CANCELLED:   { bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
  STARTING:    { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'     },
  REGISTERING: { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'     },
  RUNNING_op:  { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500'   },
  STALE:       { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'    },
  PARTIAL:     { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'    },
  DEGRADED:    { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'    },
  ERROR:       { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500'     },
  FAILED:      { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500'     },
  UNHEALTHY:   { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500'     },
  STOPPING:    { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500'   },
  UNKNOWN:     { bg: 'bg-slate-50',   text: 'text-slate-400',   dot: 'bg-slate-300'    },
  healthy:     { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500'  },
  degraded:    { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'    },
  unhealthy:   { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500'     },
  unknown:     { bg: 'bg-slate-50',   text: 'text-slate-400',   dot: 'bg-slate-300'    },
} as const;

export const LOG_LEVEL_COLORS = {
  debug: 'text-slate-400',
  info:  'text-blue-600',
  warn:  'text-amber-600',
  error: 'text-rose-600',
  fatal: 'text-rose-700 font-bold',
} as const;

export const ENTITY_TYPE_COLORS: Record<string, string> = {
  PRODUCT:   '#4f46e5',
  CUSTOMER:  '#0891b2',
  INVENTORY: '#059669',
  SALE:      '#d97706',
  SUPPLIER:  '#7c3aed',
  USER:      '#db2777',
  MOVEMENT:  '#ea580c',
  PURCHASE:  '#65a30d',
  PRICE:     '#0ea5e9',
  CATEGORY:  '#8b5cf6',
  UNKNOWN:   '#94a3b8',
};

export const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Dashboard',  group: 'overview' },
  { href: '/connectors', label: 'Connectors', group: 'data'     },
  { href: '/agents',     label: 'Agents',     group: 'data'     },
  { href: '/databases',  label: 'Databases',  group: 'data'     },
  { href: '/discovery',  label: 'Discovery',  group: 'intel'    },
  { href: '/sync',       label: 'Sync',       group: 'ops'      },
  { href: '/health',     label: 'Health',     group: 'ops'      },
  { href: '/logs',       label: 'Logs',       group: 'ops'      },
  { href: '/settings',   label: 'Settings',   group: 'admin'    },
  { href: '/users',      label: 'Users',      group: 'admin'    },
] as const;
