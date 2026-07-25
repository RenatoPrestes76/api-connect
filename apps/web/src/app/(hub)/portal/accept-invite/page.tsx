'use client';
import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInvite, useAcceptInvite } from '@/hooks/use-portal';
import { PageLoading } from '@/components/common/loading-state';

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const { data: invite, isLoading, error: inviteError } = useInvite(token);
  const acceptInvite = useAcceptInvite();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    if (!token) return;
    try {
      await acceptInvite.mutateAsync({ token, password });
      router.push('/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <p className="text-sm text-red-300">Link de convite inválido — token ausente.</p>
      </div>
    );
  }

  if (isLoading) return <PageLoading />;

  if (inviteError || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <p className="text-sm text-red-300">
          {inviteError instanceof Error
            ? inviteError.message
            : 'Convite não encontrado ou expirado.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-100">Bem-vindo(a), {invite.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Você foi convidado como <span className="capitalize">{invite.role.toLowerCase()}</span>.
            Defina sua senha para continuar.
          </p>
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
            <label className="block text-sm font-medium text-slate-300" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300" htmlFor="confirmPassword">
              Confirmar senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={acceptInvite.isPending}
            className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {acceptInvite.isPending ? 'Confirmando...' : 'Definir senha e entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
