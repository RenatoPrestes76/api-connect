import { cpGet } from '@/lib/control-plane-client';
import type { DashboardSummary } from '@/types/control-plane';
import type { AuditEntry } from '@/services/audit.service';

export type { DashboardSummary };

export interface DashboardData {
  summary: DashboardSummary;
  recentAudit: AuditEntry[];
}

export async function getDashboardSummary(): Promise<DashboardData> {
  return cpGet<DashboardData>('/dashboard');
}
