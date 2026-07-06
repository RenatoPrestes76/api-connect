'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Server,
  Building2,
  Plug,
  ScrollText,
  Activity,
} from 'lucide-react';
import { cn } from '../../lib/utils.js';

interface NavItem {
  href:  string;
  label: string;
  icon:  typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/agents',     label: 'Agents',     icon: Server          },
  { href: '/companies',  label: 'Companies',  icon: Building2       },
  { href: '/connectors', label: 'Connectors', icon: Plug            },
  { href: '/logs',       label: 'Logs',       icon: ScrollText      },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col bg-slate-900 text-slate-300">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-800 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-700">
          <Activity className="h-4 w-4 text-slate-200" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">Atlas Console</p>
          <p className="text-[10px] text-slate-500 leading-tight">Seltriva Connect</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-4 py-3">
        <p className="text-[11px] text-slate-600">Sprint 20 — ATLAS CONSOLE</p>
      </div>
    </aside>
  );
}
