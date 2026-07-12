import type { ReactElement } from 'react';
import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';

export default function SettingsPage(): ReactElement {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Configurações gerais do Atlas Control Plane."
      />
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
        <Settings className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">Módulo em construção</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          As configurações globais serão implementadas nas próximas micro-sprints do Control Plane.
        </p>
      </div>
    </div>
  );
}
