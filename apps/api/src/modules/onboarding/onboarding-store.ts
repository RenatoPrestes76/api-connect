import type {
  OnboardingSession,
  OnboardingLog,
  InstallationReport,
  SetupStep,
  SessionStatus,
} from './types.js';

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class OnboardingStore {
  private readonly sessions = new Map<string, OnboardingSession>();
  private readonly logs: OnboardingLog[] = [];
  private readonly reports: InstallationReport[] = [];

  createSession(): OnboardingSession {
    const id = genId('sess');
    const token = genId('tkn');
    const now = nowIso();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const session: OnboardingSession = {
      id,
      tenantId: null,
      workspaceId: null,
      agentId: null,
      apiKey: null,
      currentStep: 'company',
      status: 'active',
      provisionTasks: [],
      validationChecks: [],
      token,
      expiresAt,
      startedAt: now,
      updatedAt: now,
    };
    this.sessions.set(id, session);
    this.addLog(id, 'session.created', { id });
    return session;
  }

  getSession(id: string): OnboardingSession | null {
    return this.sessions.get(id) ?? null;
  }

  updateSession(id: string, updates: Partial<OnboardingSession>): OnboardingSession | null {
    const session = this.sessions.get(id);
    if (!session) return null;
    const updated: OnboardingSession = { ...session, ...updates, updatedAt: nowIso() };
    this.sessions.set(id, updated);
    return updated;
  }

  advanceStep(id: string, step: SetupStep): OnboardingSession | null {
    return this.updateSession(id, { currentStep: step });
  }

  setStatus(id: string, status: SessionStatus): OnboardingSession | null {
    return this.updateSession(id, { status });
  }

  addLog(sessionId: string, event: string, payload: Record<string, unknown> = {}): void {
    this.logs.push({
      id: genId('log'),
      sessionId,
      event,
      payload,
      createdAt: nowIso(),
    });
  }

  getLogs(sessionId: string): OnboardingLog[] {
    return this.logs.filter((l) => l.sessionId === sessionId);
  }

  saveReport(report: InstallationReport): void {
    this.reports.push(report);
  }

  getReports(): InstallationReport[] {
    return [...this.reports];
  }
}

export const onboardingStore = new OnboardingStore();
