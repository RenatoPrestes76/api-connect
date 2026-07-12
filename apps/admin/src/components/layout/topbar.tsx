'use client';
import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { Bell, LogOut, Search, Shield } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAdminAuth } from '@/hooks/use-admin-auth';

export function Topbar(): ReactElement {
  const [search, setSearch] = useState('');
  const { user, logout } = useAdminAuth();

  const handleLogout = async (): Promise<void> => {
    await logout();
    window.location.href = '/login';
  };

  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'A';

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-6">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent">
          <Shield className="h-4 w-4 text-accent-foreground" aria-hidden />
        </div>
        <span className="hidden text-sm font-semibold text-foreground sm:block">
          Atlas Control Plane
        </span>
      </Link>

      <div className="relative max-w-md flex-1">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresas, runtimes, usuários…"
          className="pl-9"
          aria-label="Busca global"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notificações">
              <Bell className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              Nenhuma notificação por enquanto.
            </p>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-foreground hover:bg-muted">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-xs font-medium text-accent">
                {initial}
              </div>
              <span className="hidden sm:block">{user?.name ?? 'Admin'}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {user?.name}
              {user?.role ? ` · ${user.role}` : ''}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
