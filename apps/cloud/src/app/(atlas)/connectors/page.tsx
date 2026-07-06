import { PageHeader } from '../../../components/atlas/page-header.js';
import { Badge } from '../../../components/ui/badge.js';
import { Card, CardContent } from '../../../components/ui/card.js';
import { CONNECTOR_CATALOG } from '../../../lib/constants.js';
import { Plug } from 'lucide-react';

const VENDOR_ICONS: Record<string, string> = {
  Microsoft:  'MS',
  PostgreSQL: 'PG',
  Oracle:     'OC',
  Generic:    'GN',
  SAP:        'SP',
  TOTVS:      'TV',
  CISS:       'CS',
};

export default function ConnectorsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Connectors"
        description="Available and in-development data source connectors"
        breadcrumb={[{ label: 'Connectors' }]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONNECTOR_CATALOG.map(connector => (
          <Card key={connector.id}>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                  {VENDOR_ICONS[connector.vendor] ?? <Plug className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{connector.name}</p>
                    {connector.status === 'available' ? (
                      <Badge variant="success">Available</Badge>
                    ) : (
                      <Badge variant="muted">In development</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{connector.vendor}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{connector.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
