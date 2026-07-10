'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Plug,
  Server,
  Database,
  Search,
  RefreshCw,
  Activity,
  ScrollText,
  Settings,
  Users,
  Zap,
  GitBranch,
  Eye,
  BarChart2,
  AlertTriangle,
  ClipboardList,
  GitCommit,
  Bell,
  Shield,
  Flame,
  Bot,
  LayoutTemplate,
  Store,
  Package,
  ArrowUpCircle,
  Code2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, typeof LayoutDashboard> = {
  '/dashboard': LayoutDashboard,
  '/connectors': Plug,
  '/agents': Server,
  '/databases': Database,
  '/discovery': Search,
  '/workflows': GitBranch,
  '/workflows/templates': LayoutTemplate,
  '/marketplace': Store,
  '/marketplace/installed': Package,
  '/marketplace/updates': ArrowUpCircle,
  '/marketplace/developer': Code2,
  '/sync': RefreshCw,
  '/health': Activity,
  '/logs': ScrollText,
  '/settings': Settings,
  '/users': Users,
  '/observatory': Eye,
  '/metrics': BarChart2,
  '/incidents': AlertTriangle,
  '/audit': ClipboardList,
  '/timeline': GitCommit,
  '/alert-rules': Bell,
  '/sla': Shield,
  '/heatmaps': Flame,
  '/copilot': Bot,
};

const GROUPS = [
  {
    label: 'Overview',
    items: ['/dashboard'],
  },
  {
    label: 'Data',
    items: ['/connectors', '/agents', '/databases'],
  },
  {
    label: 'Intelligence',
    items: ['/discovery', '/workflows', '/workflows/templates', '/copilot'],
  },
  {
    label: 'Marketplace',
    items: [
      '/marketplace',
      '/marketplace/installed',
      '/marketplace/updates',
      '/marketplace/developer',
    ],
  },
  {
    label: 'Observatory',
    items: [
      '/observatory',
      '/metrics',
      '/incidents',
      '/audit',
      '/timeline',
      '/alert-rules',
      '/sla',
      '/heatmaps',
    ],
  },
  {
    label: 'Operations',
    items: ['/sync', '/health', '/logs'],
  },
  {
    label: 'Administration',
    items: ['/settings', '/users'],
  },
];

const LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/connectors': 'Connectors',
  '/agents': 'Agents',
  '/databases': 'Databases',
  '/discovery': 'Discovery',
  '/workflows': 'Workflows',
  '/workflows/templates': 'WF Templates',
  '/marketplace': 'Descobrir',
  '/marketplace/installed': 'Instalados',
  '/marketplace/updates': 'Atualizações',
  '/marketplace/developer': 'Desenvolvedores',
  '/sync': 'Sync Center',
  '/health': 'Health',
  '/logs': 'Logs',
  '/settings': 'Settings',
  '/users': 'Users',
  '/observatory': 'Observatory',
  '/metrics': 'Metrics',
  '/incidents': 'Incidents',
  '/audit': 'Audit Trail',
  '/timeline': 'Timeline',
  '/alert-rules': 'Alert Center',
  '/sla': 'SLA Monitor',
  '/heatmaps': 'Heatmaps',
  '/copilot': 'AI Copilot',
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col bg-slate-900 text-slate-300 overflow-y-auto">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-800 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
          <Zap className="h-4 w-4 text-white" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate">Atlas Hub</p>
          <p className="text-[10px] text-slate-500 leading-tight">Sprint 33</p>
        </div>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 py-3 space-y-4 px-2">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((href) => {
                const Icon = ICONS[href] ?? LayoutDashboard;
                const label = LABELS[href] ?? href;
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-800 px-4 py-3">
        <p className="text-[11px] text-slate-600">ATLAS HUB — Sprint 33</p>
      </div>
    </aside>
  );
}
