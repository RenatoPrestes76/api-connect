'use client';
import { FileText } from 'lucide-react';
import { useInvoices } from '@/hooks/use-billing';
import { InvoiceRow } from '@/components/billing/invoice-row';

const DEMO_TENANT = 'tenant-professional';

export default function InvoicesPage() {
  const { data, isLoading } = useInvoices(DEMO_TENANT);
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-xl font-semibold text-white">Invoices</h1>
          <p className="text-sm text-slate-400">
            {data ? `${data.total} invoice${data.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-slate-900 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No invoices yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} />
          ))}
        </div>
      )}
    </div>
  );
}
