'use client';
import { useState } from 'react';
import { UserPlus, Shield } from 'lucide-react';
import { usePortalUsers, useInviteUser, usePortalDashboard } from '@/hooks/use-portal';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import type { UserRole } from '@/types/portal';
import { cn } from '@/lib/utils';

const ROLE_BADGE: Record<UserRole, string> = {
  owner: 'bg-purple-900/40 text-purple-300',
  admin: 'bg-blue-900/40 text-blue-300',
  developer: 'bg-teal-900/40 text-teal-300',
  viewer: 'bg-slate-700 text-slate-400',
};

export default function UsersPage() {
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'developer' as UserRole });

  const { data, isLoading, error } = usePortalUsers();
  const { data: dash } = usePortalDashboard();
  const invite = useInviteUser();

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message="Erro ao carregar usuários" />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Gerenciamento de Usuários</h1>
          <p className="text-sm text-slate-400">
            {data?.total ?? 0} usuários · Plan:{' '}
            <span className="capitalize">{dash?.plan ?? '—'}</span>
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" /> Convidar
        </button>
      </div>

      {showInvite && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-medium text-slate-200">Convidar Usuário</h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              placeholder="Nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <select
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
          >
            {(['owner', 'admin', 'developer', 'viewer'] as UserRole[]).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => invite.mutate(form, { onSuccess: () => setShowInvite(false) })}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              Enviar convite
            </button>
            <button
              onClick={() => setShowInvite(false)}
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              {['Nome', 'Email', 'Perfil', 'MFA', 'Último Login', 'Status'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(data?.users ?? []).map((user) => (
              <tr key={user.id} className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 font-medium text-slate-200">{user.name}</td>
                <td className="px-4 py-2.5 text-slate-400">{user.email}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn('rounded px-2 py-0.5 text-xs font-medium', ROLE_BADGE[user.role])}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {user.mfaEnabled ? (
                    <Shield className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn('text-xs', {
                      'text-green-400': user.status === 'active',
                      'text-yellow-400': user.status === 'invited',
                      'text-red-400': user.status === 'suspended',
                    })}
                  >
                    {user.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
