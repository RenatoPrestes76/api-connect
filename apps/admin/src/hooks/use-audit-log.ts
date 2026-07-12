import { useQuery } from '@tanstack/react-query';
import { listAuditEntries } from '@/services/audit.service';

export function useAuditLog(limit = 50) {
  return useQuery({
    queryKey: ['admin-audit-log', limit],
    queryFn: () => listAuditEntries(limit),
  });
}
