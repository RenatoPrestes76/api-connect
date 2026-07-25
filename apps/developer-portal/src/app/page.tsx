import type { JSX } from 'react';

export default function HomePage(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-center">
      <h1 className="text-3xl font-semibold text-slate-100">Atlas Forge</h1>
      <p className="max-w-md text-sm text-slate-400">
        O Developer Portal do Seltriva Connect está em construção. Em breve você poderá publicar e
        gerenciar plugins por aqui.
      </p>
    </main>
  );
}
