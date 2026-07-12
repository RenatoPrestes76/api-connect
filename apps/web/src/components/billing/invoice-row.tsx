'use client';
import { FileText, Download } from 'lucide-react';
import type { Invoice } from '@/types/billing';

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-500/20 text-emerald-400',
  open: 'bg-amber-500/20 text-amber-400',
  draft: 'bg-slate-600 text-slate-400',
  void: 'bg-slate-700 text-slate-500',
  uncollectible: 'bg-rose-500/20 text-rose-400',
};

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

interface InvoiceRowProps {
  invoice: Invoice;
}

export function InvoiceRow({ invoice }: InvoiceRowProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 hover:bg-slate-800 transition-colors">
      <FileText className="h-4 w-4 text-slate-500 shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{invoice.number}</p>
        <p className="text-xs text-slate-500">
          {new Date(invoice.issuedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>
      </div>

      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[invoice.status] ?? 'bg-slate-700 text-slate-400'}`}
      >
        {invoice.status}
      </span>

      <span className="text-sm font-mono text-slate-300 tabular-nums">
        {formatAmount(invoice.total, invoice.currency)}
      </span>

      {invoice.pdfUrl ? (
        <a
          href={invoice.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-500 hover:text-slate-300 transition-colors"
          title="Download PDF"
        >
          <Download className="h-4 w-4" />
        </a>
      ) : (
        <div className="w-4" />
      )}
    </div>
  );
}
