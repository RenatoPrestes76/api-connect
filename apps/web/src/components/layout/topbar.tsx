'use client';
import { Bell, LogOut, ChevronDown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { logout } from '@/services/auth.service';
import { Button } from '@/components/ui/button';

const TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/connectors': 'Connectors',
  '/agents':     'Agents',
  '/databases':  'Databases',
  '/discovery':  'Discovery Reports',
  '/sync':       'Sync Center',
  '/health':     'Health Monitor',
  '/logs':       'Logs',
  '/settings':   'Settings',
  '/users':      'Users',
};

export function Topbar() {
  const pathname  = usePathname();
  const rootPath  = '/' + (pathname.split('/')[1] ?? '');
  const title     = TITLES[rootPath] ?? 'Atlas Hub';

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>

      <div className="flex items-center gap-2">
        <button
          className="relative rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 cursor-pointer">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
            A
          </div>
          <span className="hidden sm:block">Admin</span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </div>

        <Button size="icon" variant="ghost" onClick={() => void handleLogout()} aria-label="Log out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
