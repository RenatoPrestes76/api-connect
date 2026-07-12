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
  CreditCard,
  Layers,
  FileText,
  BarChart3,
  ShieldCheck,
  TrendingUp,
  Lock,
  KeyRound,
  ListChecks,
  ClipboardCheck,
  CheckCircle2,
  Cpu,
  ToggleLeft,
  DatabaseZap,
  HeartPulse,
  Gauge,
  Globe,
  Ticket,
  Key,
  UserCog,
  Wifi,
  Rocket,
  ListTodo,
  History,
  GraduationCap,
  Wand2,
  Network,
  ServerCog,
  Globe2,
  ShieldAlert,
  Scale,
  TriangleAlert,
  GitPullRequest,
  Activity as ActivityIcon,
  Telescope,
  BrainCircuit,
  Zap as ZapIcon,
  Radio,
  GitMerge,
  BookOpen,
  ShieldCheck as ShieldCheckIcon,
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
  '/billing': CreditCard,
  '/billing/plans': Layers,
  '/billing/invoices': FileText,
  '/billing/usage': BarChart3,
  '/billing/admin': TrendingUp,
  '/security': ShieldCheck,
  '/security/secrets': Lock,
  '/security/policies': ListChecks,
  '/security/audit': ClipboardCheck,
  '/security/compliance': CheckCircle2,
  '/security/sso': KeyRound,
  '/ops': Cpu,
  '/ops/queues': DatabaseZap,
  '/ops/feature-flags': ToggleLeft,
  '/ops/slo': Gauge,
  '/ops/dr': HeartPulse,
  '/portal': Globe,
  '/portal/support': Ticket,
  '/portal/api-keys': Key,
  '/portal/users': UserCog,
  '/portal/connectors': Wifi,
  '/release': Rocket,
  '/release/checklist': ListTodo,
  '/release/changelog': History,
  '/academy': GraduationCap,
  '/setup': Wand2,
  '/operations': Network,
  '/infrastructure': ServerCog,
  '/global': Globe2,
  '/governance': ShieldAlert,
  '/governance/audit': ScrollText,
  '/governance/compliance': Scale,
  '/governance/risk': TriangleAlert,
  '/governance/changes': GitPullRequest,
  '/prometheus': Telescope,
  '/prometheus/incidents': BrainCircuit,
  '/prometheus/copilot': ActivityIcon,
  '/helios': Radio,
  '/helios/catalog': BookOpen,
  '/helios/governance': ShieldCheckIcon,
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
    label: 'Billing',
    items: ['/billing', '/billing/plans', '/billing/invoices', '/billing/usage', '/billing/admin'],
  },
  {
    label: 'Security',
    items: [
      '/security',
      '/security/secrets',
      '/security/policies',
      '/security/audit',
      '/security/compliance',
      '/security/sso',
    ],
  },
  {
    label: 'Production',
    items: ['/ops', '/ops/queues', '/ops/feature-flags', '/ops/slo', '/ops/dr'],
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
    label: 'Customer Portal',
    items: [
      '/portal',
      '/portal/support',
      '/portal/api-keys',
      '/portal/users',
      '/portal/connectors',
    ],
  },
  {
    label: 'GA Release',
    items: ['/release', '/release/checklist', '/release/changelog', '/academy'],
  },
  {
    label: 'Enterprise',
    items: ['/operations', '/infrastructure', '/global'],
  },
  {
    label: 'Governance',
    items: [
      '/governance',
      '/governance/audit',
      '/governance/compliance',
      '/governance/risk',
      '/governance/changes',
    ],
  },
  {
    label: 'AIOps',
    items: ['/prometheus', '/prometheus/incidents', '/prometheus/copilot'],
  },
  {
    label: 'Event Mesh',
    items: ['/helios', '/helios/catalog', '/helios/governance'],
  },
  {
    label: 'Operations',
    items: ['/sync', '/health', '/logs'],
  },
  {
    label: 'Administration',
    items: ['/settings', '/users', '/setup'],
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
  '/billing': 'Overview',
  '/billing/plans': 'Plans',
  '/billing/invoices': 'Invoices',
  '/billing/usage': 'Usage',
  '/billing/admin': 'Admin Dashboard',
  '/security': 'Dashboard',
  '/security/secrets': 'Secrets',
  '/security/policies': 'Policies',
  '/security/audit': 'Audit Chain',
  '/security/compliance': 'Compliance',
  '/security/sso': 'SSO & MFA',
  '/ops': 'Dashboard',
  '/ops/queues': 'Worker Queues',
  '/ops/feature-flags': 'Feature Flags',
  '/ops/slo': 'SLO / SLA',
  '/ops/dr': 'Disaster Recovery',
  '/portal': 'Dashboard',
  '/portal/support': 'Suporte',
  '/portal/api-keys': 'Chaves de API',
  '/portal/users': 'Usuários',
  '/portal/connectors': 'Conectores',
  '/release': 'Go-Live Center',
  '/release/checklist': 'Checklist GA',
  '/release/changelog': 'Changelog',
  '/academy': 'Atlas Academy',
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
  '/setup': 'Setup Wizard',
  '/operations': 'Operations Center',
  '/infrastructure': 'Infrastructure HA',
  '/global': 'Global Edge',
  '/governance': 'Governance',
  '/governance/audit': 'Audit Trail',
  '/governance/compliance': 'Compliance',
  '/governance/risk': 'Risk Register',
  '/governance/changes': 'Change Mgmt',
  '/prometheus': 'PROMETHEUS',
  '/prometheus/incidents': 'Incidents & RCA',
  '/prometheus/copilot': 'AIOps Center',
  '/helios': 'Event Studio',
  '/helios/catalog': 'Catalog & Schema',
  '/helios/governance': 'Governance',
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
          <p className="text-[10px] text-slate-500 leading-tight">Sprint 44 — PROMETHEUS</p>
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
        <p className="text-[11px] text-slate-600">ATLAS CONNECT v1.0 — Sprint 45</p>
      </div>
    </aside>
  );
}
