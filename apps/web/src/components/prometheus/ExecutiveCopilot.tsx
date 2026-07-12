'use client';

import { useState } from 'react';
import type { CopilotResponse } from '@/types/prometheus';

const QUICK_QUESTIONS = [
  'Por que houve queda no SLA hoje?',
  'Quais clientes tiveram mais erros?',
  'Quanto custaram as integrações este mês?',
  'Qual ERP apresentou maior latência?',
  'Qual Agent está sobrecarregado?',
  'Onde devemos expandir infraestrutura?',
];

interface Props {
  onQuery: (question: string) => Promise<CopilotResponse>;
}

export function ExecutiveCopilot({ onQuery }: Props) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<CopilotResponse[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const resp = await onQuery(q.trim());
      setHistory((prev) => [resp, ...prev]);
      setQuestion('');
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex flex-col h-full min-h-[400px]">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Executive AI Copilot</h3>
        <p className="text-xs text-zinc-400 mt-0.5">
          Ask anything about platform operations, costs, and performance
        </p>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {history.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide">
              Quick questions
            </p>
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => submit(q)}
                className="block w-full text-left text-xs text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-1 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded transition-colors"
              >
                → {q}
              </button>
            ))}
          </div>
        )}
        {history.map((entry, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                Q
              </span>
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {entry.question}
              </p>
            </div>
            <div className="flex items-start gap-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-2">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                A
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-700 dark:text-zinc-300">{entry.answer}</p>
                {entry.relatedMetrics.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {entry.relatedMetrics.map((m, j) => (
                      <span
                        key={j}
                        className="text-[10px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-0.5 text-zinc-600 dark:text-zinc-400"
                      >
                        {m.label}:{' '}
                        <strong className="text-zinc-800 dark:text-zinc-200">{m.value}</strong>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-zinc-400 mt-1">
                  Confidence: {entry.confidence}% · Sources: {entry.sources.join(', ')}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit(question)}
          placeholder="Ask about operations, costs, latency…"
          className="flex-1 text-xs border border-zinc-200 dark:border-zinc-600 rounded px-3 py-1.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 placeholder-zinc-400"
        />
        <button
          onClick={() => submit(question)}
          disabled={loading || !question.trim()}
          className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 text-white rounded px-3 py-1.5 transition-colors"
        >
          {loading ? '…' : 'Ask'}
        </button>
      </div>
    </div>
  );
}
