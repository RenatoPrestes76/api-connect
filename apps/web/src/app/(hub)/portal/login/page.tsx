'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useLogin } from '@/hooks/use-portal';

export default function PortalLoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ email, password });
      router.push('/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-100">Portal do Cliente</h1>
          <p className="mt-1 text-sm text-slate-400">Entre na sua organização</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {login.isPending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Ainda não tem uma organização?{' '}
          <a href="/portal/register" className="text-blue-400 hover:underline">
            Criar conta
          </a>
        </p>
      </div>
    </div>
  );
}
