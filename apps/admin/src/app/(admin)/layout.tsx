'use client';
import type { ReactElement, ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { PageLoading } from '@/components/common/loading-state';
import { useAdminAuth } from '@/hooks/use-admin-auth';

export default function AdminLayout({ children }: { children: ReactNode }): ReactElement {
  const { loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <PageLoading message="Carregando sessão…" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
