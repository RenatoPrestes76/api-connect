'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useRegister } from '@/hooks/use-portal';
import type { Organization } from '@/types/portal';

export default function PortalRegisterPage() {
  const router = useRouter();
  const register = useRegister();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    razaoSocial: '',
    cnpj: '',
    internalCode: '',
    plan: 'community' as Organization['plan'],
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register.mutateAsync({
        name: form.name,
        razaoSocial: form.razaoSocial,
        cnpj: form.cnpj,
        internalCode: form.internalCode,
        plan: form.plan,
        owner: { name: form.ownerName, email: form.ownerEmail, password: form.ownerPassword },
      });
      router.push('/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-100">Criar Organização</h1>
          <p className="mt-1 text-sm text-slate-400">Cadastre sua empresa no Atlas Connect</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-800 bg-red-900/20 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Nome"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
            />
            <input
              placeholder="Código interno"
              required
              value={form.internalCode}
              onChange={(e) => set('internalCode', e.target.value)}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
            />
          </div>
          <input
            placeholder="Razão Social"
            required
            value={form.razaoSocial}
            onChange={(e) => set('razaoSocial', e.target.value)}
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="CNPJ"
              required
              value={form.cnpj}
              onChange={(e) => set('cnpj', e.target.value)}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
            />
            <select
              value={form.plan}
              onChange={(e) => set('plan', e.target.value)}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
            >
              <option value="community">Community</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Administrador (Owner)
            </p>
            <div className="space-y-2">
              <input
                placeholder="Nome"
                required
                value={form.ownerName}
                onChange={(e) => set('ownerName', e.target.value)}
                className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              />
              <input
                type="email"
                placeholder="Email"
                required
                value={form.ownerEmail}
                onChange={(e) => set('ownerEmail', e.target.value)}
                className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              />
              <input
                type="password"
                placeholder="Senha (mín. 8 caracteres)"
                required
                minLength={8}
                value={form.ownerPassword}
                onChange={(e) => set('ownerPassword', e.target.value)}
                className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-slate-200 border border-slate-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={register.isPending}
            className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {register.isPending ? 'Criando...' : 'Criar organização'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Já tem uma conta?{' '}
          <a href="/portal/login" className="text-blue-400 hover:underline">
            Entrar
          </a>
        </p>
      </div>
    </div>
  );
}
