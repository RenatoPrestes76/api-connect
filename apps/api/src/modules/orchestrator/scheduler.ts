/**
 * Sprint 29 — ORCHESTRATOR
 * Simple in-memory scheduler that fires CRON-triggered workflows.
 * Uses Node.js setInterval for demo; production would use a proper cron library.
 */
import type { Workflow } from './types.js';
import { orchestratorStore } from './orchestrator-store.js';
import { executeWorkflow } from './execution-engine.js';
import { enqueue } from './queue.js';

interface ScheduledJob {
  workflowId: string;
  cronExpr: string;
  handle: ReturnType<typeof setInterval>;
}

class Scheduler {
  private jobs: Map<string, ScheduledJob> = new Map();

  schedule(workflow: Workflow): void {
    if (!workflow.active || workflow.triggerType !== 'CRON') return;
    if (this.jobs.has(workflow.id)) return; // already scheduled

    // In demo: fire every 60s regardless of cronExpr
    const handle = setInterval(() => {
      const wf = orchestratorStore.workflows.get(workflow.id);
      if (!wf?.active) {
        this.unschedule(workflow.id);
        return;
      }
      void executeWorkflow(wf, {}, 'CRON');
    }, 60_000);

    const triggerNode = workflow.graph.nodes.find((n) => n.type === 'trigger');
    const cronExpr = (triggerNode?.config as { cronExpr?: string })?.cronExpr ?? '* * * * *';

    this.jobs.set(workflow.id, { workflowId: workflow.id, cronExpr, handle });
  }

  unschedule(workflowId: string): void {
    const job = this.jobs.get(workflowId);
    if (job) {
      clearInterval(job.handle);
      this.jobs.delete(workflowId);
    }
  }

  scheduledWorkflowIds(): string[] {
    return [...this.jobs.keys()];
  }

  triggerManual(workflowId: string, input?: Record<string, unknown>): void {
    const wf = orchestratorStore.workflows.get(workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found`);
    enqueue(wf.id, wf.name, 'MANUAL', input);
    void executeWorkflow(wf, input ?? {}, 'MANUAL');
  }
}

export const scheduler = new Scheduler();
