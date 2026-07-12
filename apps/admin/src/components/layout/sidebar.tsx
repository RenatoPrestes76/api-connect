'use client';
import type { ReactElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function Sidebar(): ReactElement {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <nav className="flex-1 space-y-0.5 px-2 pb-3 pt-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-border text-white'
                  : 'text-sidebar-foreground hover:bg-sidebar-border/60 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{label}</span>
              {badge != null && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-4 py-3">
        <p className="text-[11px] text-sidebar-foreground/50">ATLAS CONTROL PLANE v0.1</p>
      </div>
    </aside>
  );
}
