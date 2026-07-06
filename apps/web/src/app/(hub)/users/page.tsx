'use client';
import { useState } from 'react';
import { Users, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { EmptyState } from '@/components/common/empty-state';
import { DataTable, type Column } from '@/components/common/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUsers, useCreateUser, useDeleteUser } from '@/hooks/use-users';
import { ROLE_LABELS } from '@/lib/constants';
import { formatRelative } from '@/lib/utils';
import type { HubUser, UserRole } from '@/types/index';

const ROLE_BADGE: Record<UserRole, 'primary' | 'warning' | 'danger' | 'muted'> = {
  SUPER_ADMIN: 'danger',
  ADMIN:       'primary',
  OPERATOR:    'warning',
  READ_ONLY:   'muted',
};

const columns: Column<HubUser>[] = [
  {
    key:    'name',
    header: 'User',
    cell:   (u) => (
      <div>
        <p className="font-medium text-slate-900">{u.name}</p>
        <p className="text-xs text-slate-400">{u.email}</p>
      </div>
    ),
  },
  {
    key:    'role',
    header: 'Role',
    cell:   (u) => (
      <Badge variant={ROLE_BADGE[u.role] ?? 'muted'}>
        {ROLE_LABELS[u.role] ?? u.role}
      </Badge>
    ),
  },
  {
    key:    'active',
    header: 'Active',
    cell:   (u) => (
      <span className={u.active ? 'text-emerald-600 text-xs font-medium' : 'text-slate-400 text-xs'}>
        {u.active ? 'Active' : 'Inactive'}
      </span>
    ),
  },
  {
    key:    'lastLogin',
    header: 'Last Login',
    cell:   (u) => u.lastLogin
      ? <span className="text-xs text-slate-600">{formatRelative(u.lastLogin)}</span>
      : <span className="text-slate-400 text-xs">Never</span>,
  },
];

export default function UsersPage() {
  const { data, isLoading, error, refetch } = useUsers();
  const createMutation = useCreateUser();
  const deleteMutation = useDeleteUser();

  const [showAdd, setShowAdd] = useState(false);
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [role,    setRole]    = useState<UserRole>('READ_ONLY');
  const [addErr,  setAddErr]  = useState<string | null>(null);

  const handleAdd = async () => {
    setAddErr(null);
    if (!name.trim() || !email.trim()) return;
    try {
      await createMutation.mutateAsync({ name, email, role });
      setName(''); setEmail(''); setRole('READ_ONLY'); setShowAdd(false);
    } catch (err) {
      setAddErr(err instanceof Error ? err.message : 'Failed to create user.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    await deleteMutation.mutateAsync(id);
  };

  const columnsWithActions: Column<HubUser>[] = [
    ...columns,
    {
      key:    'actions',
      header: '',
      cell:   (u) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); void handleDelete(u.id); }}
          className="text-rose-500 hover:text-rose-700"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  if (isLoading) return <PageLoading />;
  if (error)     return <ErrorState message="Could not load users." onRetry={() => void refetch()} />;

  const users = data ?? [];

  return (
    <div className="space-y-4 max-w-screen-xl">
      <PageHeader
        title="Users"
        description={`${users.length} user${users.length !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add User
          </Button>
        }
      />

      {showAdd && (
        <Card>
          <CardHeader><CardTitle>New User</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {addErr && (
              <p className="text-sm text-rose-600 bg-rose-50 rounded px-3 py-2">{addErr}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" loading={createMutation.isPending} onClick={() => void handleAdd()}>
                Create
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {users.length === 0 ? (
        <EmptyState icon={Users} title="No users" description="Add your first user above." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <DataTable
            data={users}
            columns={columnsWithActions}
            keyFn={(u) => u.id}
          />
        </div>
      )}
    </div>
  );
}
