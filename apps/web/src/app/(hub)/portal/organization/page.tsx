'use client';
import { useEffect, useState } from 'react';
import { useOrganization, useUpdateOrganization } from '@/hooks/use-portal';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';

export default function OrganizationPage() {
  const { data: organization, isLoading, error } = useOrganization();
  const update = useUpdateOrganization();

  const [form, setForm] = useState({ name: '', razaoSocial: '', cnpj: '', internalCode: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!organization) return;
    setForm({
      name: organization.name,
      razaoSocial: organization.razaoSocial,
      cnpj: organization.cnpj,
      internalCode: organization.internalCode,
    });
  }, [organization]);

  if (isLoading) return <PageLoading />;
  if (error || !organization) return <ErrorState message="Erro ao carregar organização" />;

  const handleSave = async () => {
    await update.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Organização</h1>
        <p className="text-sm text-slate-400">
          Plano <span className="capitalize">{organization.plan}</span> · Status{' '}
          <span className="capitalize">{organization.status}</span>
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800 p-4">
        {saved && <p className="text-sm text-emerald-400">Alterações salvas.</p>}

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-500">Nome</label>
          <input
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-500">Razão Social</label>
          <input
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
            value={form.razaoSocial}
            onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500">CNPJ</label>
            <input
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500">Código interno</label>
            <input
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              value={form.internalCode}
              onChange={(e) => setForm({ ...form, internalCode: e.target.value })}
            />
          </div>
        </div>

        <button
          onClick={() => void handleSave()}
          disabled={update.isPending}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {update.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
