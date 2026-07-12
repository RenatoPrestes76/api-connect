'use client';
import { useState } from 'react';
import type { AdminFormData } from '@/types/setup';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  loading: boolean;
  onNext: (data: AdminFormData) => void;
  onBack: () => void;
}

export function StepAdmin({ loading, onNext, onBack }: Props) {
  const [form, setForm] = useState<AdminFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    mfaEnabled: false,
  });
  const [showPwd, setShowPwd] = useState(false);

  const set = (k: keyof AdminFormData, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const pwdMatch = !form.confirmPassword || form.password === form.confirmPassword;
  const isValid = form.name && form.email && form.password && pwdMatch;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onNext(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Nome Completo <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            placeholder="Super Admin"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            E-mail <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            placeholder="admin@empresa.com"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Senha <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-10 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
              placeholder="Min. 8 caracteres"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              required
              minLength={8}
            />
            <button
              type="button"
              className="absolute right-2 top-2.5 text-slate-500 hover:text-slate-300"
              onClick={() => setShowPwd(!showPwd)}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Confirmar Senha</label>
          <input
            type={showPwd ? 'text' : 'password'}
            className={cn(
              'w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none',
              !pwdMatch
                ? 'border-red-500 focus:border-red-400'
                : 'border-slate-700 focus:border-indigo-500'
            )}
            placeholder="Repita a senha"
            value={form.confirmPassword}
            onChange={(e) => set('confirmPassword', e.target.value)}
          />
          {!pwdMatch && <p className="mt-1 text-xs text-red-400">As senhas não coincidem</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Telefone</label>
        <input
          type="tel"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
          placeholder="+55 11 99999-9999"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={() => set('mfaEnabled', !form.mfaEnabled)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
          form.mfaEnabled
            ? 'border-green-700/40 bg-green-900/10'
            : 'border-slate-700 bg-slate-800 hover:border-slate-600'
        )}
      >
        <Shield className={cn('h-5 w-5', form.mfaEnabled ? 'text-green-400' : 'text-slate-500')} />
        <div>
          <p className="text-sm font-medium text-slate-200">Autenticação Multi-Fator (MFA)</p>
          <p className="text-xs text-slate-500">
            {form.mfaEnabled ? 'Ativado — TOTP ou SMS' : 'Recomendado para contas administrativas'}
          </p>
        </div>
        <div
          className={cn(
            'ml-auto h-5 w-5 rounded-full border-2 flex items-center justify-center',
            form.mfaEnabled ? 'border-green-500 bg-green-500' : 'border-slate-600'
          )}
        >
          {form.mfaEnabled && <span className="text-[10px] text-white font-bold">✓</span>}
        </div>
      </button>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-300"
        >
          ← Voltar
        </button>
        <button
          type="submit"
          disabled={loading || !isValid}
          className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Próximo →'}
        </button>
      </div>
    </form>
  );
}
