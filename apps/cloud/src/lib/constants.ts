export const ATLAS_API_URL =
  process.env['NEXT_PUBLIC_ATLAS_API_URL'] ??
  process.env['ATLAS_API_URL'] ??
  'http://localhost:3001';

export const POLL_INTERVAL_MS = 15_000; // 15 s — heartbeat polling

export const STATUS_COLORS = {
  ONLINE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  STALE: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  OFFLINE: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-400' },
  REGISTERING: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  SYNCING: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  ERROR: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  DISABLED: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
} as const;

export const CONNECTOR_CATALOG = [
  { id: 'mssql', name: 'SQL Server', vendor: 'Microsoft', status: 'available' as const },
  { id: 'pgsql', name: 'PostgreSQL', vendor: 'PostgreSQL', status: 'available' as const },
  { id: 'mysql', name: 'MySQL', vendor: 'Oracle', status: 'available' as const },
  { id: 'rest', name: 'REST API', vendor: 'Generic', status: 'available' as const },
  { id: 'csv', name: 'CSV/File', vendor: 'Generic', status: 'available' as const },
  { id: 'oracle', name: 'Oracle DB', vendor: 'Oracle', status: 'development' as const },
  { id: 'sap', name: 'SAP', vendor: 'SAP', status: 'development' as const },
  { id: 'totvs', name: 'TOTVS', vendor: 'TOTVS', status: 'development' as const },
  { id: 'ciss', name: 'CISS', vendor: 'CISS', status: 'development' as const },
] as const;

export type ConnectorStatus = 'available' | 'installed' | 'development';
