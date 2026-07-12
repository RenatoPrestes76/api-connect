export interface AuditEntry {
  id: string;
  action: string;
  actorId?: string;
  actorEmail: string;
  target?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export async function listAuditEntries(limit = 50): Promise<AuditEntry[]> {
  const res = await fetch(`/api/admin/audit-log?limit=${limit}`, { credentials: 'include' });
  if (!res.ok) return [];
  const data = (await res.json()) as { entries: AuditEntry[] };
  return data.entries;
}
