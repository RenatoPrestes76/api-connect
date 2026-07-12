import type { ReactElement, ReactNode } from 'react';
import type { Permission } from '@/types';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { AccessDenied } from './require-role';

interface RequirePermissionProps {
  permission: Permission | Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({
  permission,
  children,
  fallback,
}: RequirePermissionProps): ReactElement | null {
  const { user, hasPermission } = useAdminAuth();
  const permissions = Array.isArray(permission) ? permission : [permission];
  const allowed = permissions.some((p) => hasPermission(p));

  if (!user) return null;
  if (!allowed) return fallback ? <>{fallback}</> : <AccessDenied />;
  return <>{children}</>;
}
