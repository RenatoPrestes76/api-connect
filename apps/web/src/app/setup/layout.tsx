import type { ReactNode } from 'react';
import { Zap } from 'lucide-react';

export const metadata = {
  title: 'Atlas Connect — Setup Wizard',
};

export default function SetupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-3">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Atlas Connect</p>
            <p className="text-[10px] text-slate-500 leading-tight">Setup Wizard — ORION</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}
