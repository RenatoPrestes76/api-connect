import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { listAuditEntries, type AuditEntry } from '@/services/audit.service';

export function useAuditLog(limit = 50): UseQueryResult<AuditEntry[]> {
  return useQuery({
    queryKey: ['admin-audit-log', limit],
    queryFn: () => listAuditEntries(limit),
  });
}
