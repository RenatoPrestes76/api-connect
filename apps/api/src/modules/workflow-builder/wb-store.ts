import { randomUUID } from 'node:crypto';
import type { WorkflowTemplate, WorkflowGraph } from '@seltriva/workflow-builder';
import { WORKFLOW_TEMPLATES } from '@seltriva/workflow-builder';

export interface VersionRecord {
  id: string;
  workflowId: string;
  version: number;
  graph: WorkflowGraph;
  note?: string;
  author: string;
  createdAt: string;
}

class WbStore {
  templates: WorkflowTemplate[] = [...WORKFLOW_TEMPLATES];
  versions: VersionRecord[] = [];

  getTemplate(id: string): WorkflowTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  listTemplates(category?: string): WorkflowTemplate[] {
    if (!category) return this.templates;
    return this.templates.filter((t) => t.category === category);
  }

  addVersion(
    workflowId: string,
    graph: WorkflowGraph,
    note?: string,
    author = 'system'
  ): VersionRecord {
    const existing = this.versions.filter((v) => v.workflowId === workflowId);
    const version = existing.length + 1;
    const rec: VersionRecord = {
      id: randomUUID(),
      workflowId,
      version,
      graph,
      note,
      author,
      createdAt: new Date().toISOString(),
    };
    this.versions.push(rec);
    return rec;
  }

  listVersions(workflowId: string): VersionRecord[] {
    return this.versions
      .filter((v) => v.workflowId === workflowId)
      .sort((a, b) => b.version - a.version);
  }

  getVersion(workflowId: string, version: number): VersionRecord | undefined {
    return this.versions.find((v) => v.workflowId === workflowId && v.version === version);
  }
}

export const wbStore = new WbStore();
