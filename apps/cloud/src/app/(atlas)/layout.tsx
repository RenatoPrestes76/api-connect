import type { ReactNode } from 'react';
import { Sidebar } from '../../components/atlas/sidebar';
import { Topbar } from '../../components/atlas/topbar';

export default function AtlasLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
