'use client';
import { useState } from 'react';
import { UserPlus, Trash2, Copy, Check } from 'lucide-react';
import {
  usePortalUsers,
  useInviteUser,
  usePortalDashboard,
  useInvites,
  useUpdateUserRole,
  useRemoveUser,
  usePortalSession,
} from '@/hooks/use-portal';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import type { OrgRole } from '@/types/portal';
import { cn } from '@/lib/utils';

const ROLES: OrgRole[] = ['OWNER', 'ADMINISTRATOR', 'DEVELOPER', 'OPERATOR', 'VIEWER'];

const ROLE_BADGE: Record<OrgRole, string> = {
  OWNER: 'bg-purple-900/40 text-purple-300',
  ADMINISTRATOR: 'bg-blue-900/40 text-blue-300',
  DEVELOPER: 'bg-teal-900/40 text-teal-300',
  OPERATOR: 'bg-amber-900/40 text-amber-300',
  VIEWER: 'bg-slate-700 text-slate-400',
};

export default function UsersPage() {
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'DEVELOPER' as OrgRole });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: session } = usePortalSession();
  const { data, isLoading, error } = usePortalUsers();
  const { data: dash } = usePortalDashboard(session?.user.organizationId);
  const { data: invites } = useInvites();
  const invite = useInviteUser();
  const updateRole = useUpdateUserRole();
  const removeUser = useRemoveUser();

  if (isLoading) return <PageLoading />;
  if (error) return <ErrorState message="Erro ao carregar usuários" />;

  const handleInvite = async () => {
    const result = await invite.mutateAsync(form);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setInviteLink(`${origin}/portal/accept-invite?token=${result.token}`);
    setShowInvite(false);
    setForm({ email: '', name: '', role: 'DEVELOPER' });
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

      {inviteLink && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-800 bg-emerald-900/20 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-emerald-300">Convite criado</p>
            <p className="truncate text-xs text-slate-400">
              Não há envio de e-mail ainda — compartilhe este link manualmente: {inviteLink}
            </p>
          </div>
          <button
            onClick={() => void copyInviteLink()}
            className="flex shrink-0 items-center gap-1.5 rounded bg-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-600"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}

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
            onChange={(e) => setForm({ ...form, role: e.target.value as OrgRole })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => void handleInvite()}
              disabled={invite.isPending}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
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

      {invites && invites.total > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <h3 className="mb-2 text-sm font-medium text-slate-200">
            Convites pendentes ({invites.total})
          </h3>
          <div className="space-y-1.5">
            {invites.invites.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">
                  {i.name} <span className="text-slate-500">({i.email})</span>
                </span>
                <span className={cn('rounded px-2 py-0.5 text-xs font-medium', ROLE_BADGE[i.role])}>
                  {i.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/50">
            <tr>
              {['Nome', 'Email', 'Perfil', 'Último Login', 'Status', ''].map((h) => (
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
                  <select
                    value={user.role}
                    disabled={user.role === 'OWNER'}
                    onChange={(e) =>
                      updateRole.mutate({ id: user.id, role: e.target.value as OrgRole })
                    }
                    className={cn(
                      'rounded border-0 px-2 py-0.5 text-xs font-medium disabled:opacity-70',
                      ROLE_BADGE[user.role]
                    )}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
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
                <td className="px-4 py-2.5 text-right">
                  {user.role !== 'OWNER' && (
                    <button
                      onClick={() => removeUser.mutate(user.id)}
                      aria-label={`Remover ${user.name}`}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
