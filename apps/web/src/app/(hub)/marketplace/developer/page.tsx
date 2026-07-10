'use client';
import { useState } from 'react';
import { Code2, Send, CheckCircle } from 'lucide-react';
import { usePublishConnector, useMarketplaceAudit } from '@/hooks/use-marketplace';
import { CONNECTOR_CATEGORIES } from '@/types/marketplace';

export default function DeveloperPage() {
  const publish = usePublishConnector();
  const { data: audit } = useMarketplaceAudit({ action: 'publish' });

  const [form, setForm] = useState({
    connectorId: '',
    name: '',
    version: '1.0.0',
    description: '',
    category: '',
    author: '',
  });
  const [submitted, setSubmitted] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.connectorId || !form.name || !form.version) return;
    publish.mutate(
      { ...form },
      {
        onSuccess: (res) => {
          setSubmitted(res.message);
          setForm({
            connectorId: '',
            name: '',
            version: '1.0.0',
            description: '',
            category: '',
            author: '',
          });
        },
      }
    );
  };

  const publishedLogs = audit?.items ?? [];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Code2 className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-semibold text-white">Portal do Desenvolvedor</h1>
          <p className="text-sm text-slate-400">
            Publique e gerencie seus connectors no marketplace
          </p>
        </div>
      </div>

      {/* Submit form */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Publicar Connector</h2>
        {submitted ? (
          <div className="flex items-start gap-3 rounded-lg border border-green-800/40 bg-green-900/20 p-4">
            <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-300">Submetido com sucesso!</p>
              <p className="text-xs text-slate-400 mt-0.5">{submitted}</p>
              <button
                onClick={() => setSubmitted(null)}
                className="mt-2 text-xs text-indigo-400 hover:underline"
              >
                Publicar outro
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            {[
              {
                key: 'connectorId',
                label: 'ID do Connector',
                placeholder: 'meu-connector',
                col: 1,
              },
              { key: 'name', label: 'Nome', placeholder: 'Meu Connector', col: 1 },
              { key: 'version', label: 'Versão', placeholder: '1.0.0', col: 1 },
              { key: 'author', label: 'Autor', placeholder: 'Empresa Ltda.', col: 1 },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                <input
                  value={(form as Record<string, string>)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            ))}

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descreva o que seu connector faz…"
                rows={2}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none resize-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Selecionar categoria</option>
                {CONNECTOR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={publish.isPending || !form.connectorId || !form.name}
                className="flex items-center gap-2 rounded bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                <Send className="h-4 w-4" />
                {publish.isPending ? 'Submetendo…' : 'Submeter para revisão'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Publish history */}
      {publishedLogs.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Histórico de publicações</h2>
          <div className="space-y-2">
            {publishedLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-xs text-slate-400"
              >
                <span className="font-medium text-slate-300">{log.connectorName}</span>
                <span className="font-mono">v{log.version}</span>
                <span>{new Date(log.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
