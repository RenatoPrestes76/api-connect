import type { ReactElement } from 'react';
import { Users } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';

export default function UsersPage(): ReactElement {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Gestão de usuários administrativos e permissões do Control Plane."
      />
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
        <Users className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">Módulo em construção</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          A gestão de usuários e RBAC será implementada nas próximas micro-sprints do Control Plane.
        </p>
      </div>
    </div>
  );
}
