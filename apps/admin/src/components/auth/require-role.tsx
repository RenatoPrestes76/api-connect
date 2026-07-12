import type { ReactElement, ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { AdminRole } from '@/types';
import { useAdminAuth } from '@/hooks/use-admin-auth';

interface RequireRoleProps {
  role: AdminRole | AdminRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({ role, children, fallback }: RequireRoleProps): ReactElement | null {
  const { user, hasRole } = useAdminAuth();
  const roles = Array.isArray(role) ? role : [role];
  const allowed = roles.some((r) => hasRole(r));

  if (!user) return null;
  if (!allowed) return fallback ? <>{fallback}</> : <AccessDenied />;
  return <>{children}</>;
}

export function AccessDenied(): ReactElement {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
      <ShieldAlert className="h-8 w-8 text-danger" aria-hidden />
      <p className="text-sm font-medium text-foreground">Acesso negado</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Você não tem permissão para visualizar este conteúdo.
      </p>
    </div>
  );
}
