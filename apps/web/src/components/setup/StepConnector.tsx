'use client';
import { useState } from 'react';
import type { ConnectorFormData, ConnectorType } from '@/types/setup';
import { cn } from '@/lib/utils';

interface Props {
  loading: boolean;
  onNext: (data: ConnectorFormData) => void;
  onBack: () => void;
}

const CONNECTOR_TYPES: { value: ConnectorType; label: string; desc: string }[] = [
  { value: 'rest', label: 'REST API', desc: 'HTTP/HTTPS · JSON · OpenAPI' },
  { value: 'soap', label: 'SOAP', desc: 'XML · WSDL · WS-Security' },
  { value: 'graphql', label: 'GraphQL', desc: 'Schema · Queries · Mutations' },
  { value: 'database', label: 'Banco de Dados', desc: 'SQL direto via JDBC/ODBC' },
  { value: 'file', label: 'Arquivo', desc: 'CSV · JSON · XML · Parquet' },
  { value: 'ftp', label: 'FTP / SFTP', desc: 'Transferência de arquivos' },
  { value: 'webhook', label: 'Webhook', desc: 'Push · eventos em tempo real' },
];

export function StepConnector({ loading, onNext, onBack }: Props) {
  const [form, setForm] = useState<ConnectorFormData>({
    type: 'rest',
    name: '',
    baseUrl: '',
  });

  const set = (k: keyof ConnectorFormData, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    onNext(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium text-slate-400">Tipo de Connector</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CONNECTOR_TYPES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => set('type', c.value)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                form.type === c.value
                  ? 'border-indigo-500 bg-indigo-900/20'
                  : 'border-slate-700 bg-slate-800 hover:border-slate-600'
              )}
            >
              <div
                className={cn(
                  'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                  form.type === c.value ? 'bg-indigo-400' : 'bg-slate-600'
                )}
              />
              <div>
                <p className="text-sm font-medium text-slate-200">{c.label}</p>
                <p className="text-xs text-slate-500">{c.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Nome do Connector <span className="text-red-500">*</span>
        </label>
        <input
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
          placeholder="Ex: SAP ERP, Oracle Financeiro"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          required
        />
      </div>

      {['rest', 'graphql', 'soap', 'webhook'].includes(form.type) && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">URL Base</label>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            placeholder="https://api.sistema.com/v1"
            value={form.baseUrl}
            onChange={(e) => set('baseUrl', e.target.value)}
          />
        </div>
      )}

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
          disabled={loading || !form.name}
          className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Próximo →'}
        </button>
      </div>
    </form>
  );
}
