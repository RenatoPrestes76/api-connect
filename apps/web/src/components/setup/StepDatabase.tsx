'use client';
import { useState } from 'react';
import type { DatabaseFormData, DatabaseType } from '@/types/setup';
import { DatabaseZap, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  loading: boolean;
  onNext: (data: DatabaseFormData) => void;
  onBack: () => void;
}

const DB_TYPES: { value: DatabaseType; label: string; defaultPort: number }[] = [
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
  { value: 'sqlserver', label: 'SQL Server', defaultPort: 1433 },
  { value: 'oracle', label: 'Oracle', defaultPort: 1521 },
  { value: 'supabase', label: 'Supabase', defaultPort: 5432 },
];

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

export function StepDatabase({ loading, onNext, onBack }: Props) {
  const [form, setForm] = useState<DatabaseFormData>({
    type: 'postgresql',
    host: '',
    port: '5432',
    database: 'atlas',
    username: 'admin',
    password: '',
    ssl: true,
  });
  const [testState, setTestState] = useState<TestState>('idle');

  const set = (k: keyof DatabaseFormData, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const selectType = (type: DatabaseType) => {
    const def = DB_TYPES.find((d) => d.value === type)!;
    setForm((f) => ({ ...f, type, port: String(def.defaultPort) }));
    setTestState('idle');
  };

  const testConnection = async () => {
    if (!form.host) return;
    setTestState('testing');
    // Simulated test (real call goes to API)
    await new Promise((r) => setTimeout(r, 800));
    setTestState('ok');
  };

  const isValid = form.host && form.type;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onNext(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium text-slate-400">Tipo de Banco de Dados</p>
        <div className="grid grid-cols-5 gap-2">
          {DB_TYPES.map((db) => (
            <button
              key={db.value}
              type="button"
              onClick={() => selectType(db.value)}
              className={cn(
                'rounded-lg border py-2.5 text-xs font-medium transition-colors',
                form.type === db.value
                  ? 'border-indigo-500 bg-indigo-900/20 text-indigo-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
              )}
            >
              {db.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Host <span className="text-red-500">*</span>
          </label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            placeholder="localhost ou db.empresa.com"
            value={form.host}
            onChange={(e) => set('host', e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Porta</label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            value={form.port}
            onChange={(e) => set('port', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Banco</label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            placeholder="atlas"
            value={form.database}
            onChange={(e) => set('database', e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Usuário</label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            placeholder="admin"
            value={form.username}
            onChange={(e) => set('username', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Senha</label>
        <input
          type="password"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
          placeholder="••••••••"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.ssl}
            onChange={(e) => set('ssl', e.target.checked)}
            className="rounded"
          />
          Usar SSL/TLS
        </label>
        <button
          type="button"
          disabled={!form.host || testState === 'testing'}
          onClick={testConnection}
          className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-500 disabled:opacity-50"
        >
          {testState === 'testing' && <Loader2 className="h-3 w-3 animate-spin" />}
          {testState === 'ok' && <CheckCircle2 className="h-3 w-3 text-green-400" />}
          {testState === 'fail' && <XCircle className="h-3 w-3 text-red-400" />}
          {testState === 'idle' && <DatabaseZap className="h-3 w-3" />}
          {testState === 'testing'
            ? 'Testando...'
            : testState === 'ok'
              ? 'Conexão OK'
              : testState === 'fail'
                ? 'Falhou'
                : 'Testar Conexão'}
        </button>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm text-slate-400 hover:border-slate-600 hover:text-slate-300"
        >
          ← Voltar
        </button>
        <button
          type="submit"
          disabled={loading || !isValid}
          className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Próximo →'}
        </button>
      </div>
    </form>
  );
}
