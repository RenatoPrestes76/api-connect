import {
  ReleaseChecklistRunner,
  ChangelogManager,
  VersionManager,
  GoLiveMetricsTracker,
  generateSBOM,
  CHANGELOG,
} from '@seltriva/release';
import type { ChecklistStatus, SBOM } from '@seltriva/release';

export class ReleaseStore {
  readonly checklist = new ReleaseChecklistRunner();
  readonly changelog = new ChangelogManager(CHANGELOG);
  readonly versions = new VersionManager();
  readonly goLive = new GoLiveMetricsTracker();
  private _sbom: SBOM | null = null;

  constructor() {
    this.versions.seed();
    this.goLive.seed();
    this._seedChecklist();
  }

  private _seedChecklist(): void {
    const passed: string[] = [
      'prod-001',
      'prod-002',
      'prod-003',
      'prod-004',
      'prod-005',
      'prod-006',
      'prod-007',
      'prod-008',
      'infra-001',
      'infra-002',
      'infra-003',
      'infra-004',
      'infra-005',
      'infra-006',
      'infra-007',
      'sec-001',
      'sec-002',
      'sec-003',
      'sec-004',
      'sec-005',
      'sec-006',
      'sec-007',
      'sec-008',
      'perf-001',
      'perf-002',
      'perf-003',
      'perf-004',
      'perf-005',
      'sup-001',
      'sup-002',
      'sup-003',
      'com-001',
      'com-002',
      'com-003',
      'com-004',
      'com-005',
    ];
    const pending: string[] = ['prod-009', 'infra-008', 'sup-004', 'sup-005'];

    for (const id of passed) {
      this.checklist.mark(id, 'passed', { checkedBy: 'ci-pipeline' });
    }
    for (const id of pending) {
      this.checklist.mark(id, 'pending');
    }
  }

  getSBOM(): SBOM {
    if (!this._sbom) {
      this._sbom = generateSBOM('1.0.0');
    }
    return this._sbom;
  }

  markChecklist(
    id: string,
    status: ChecklistStatus,
    opts: { notes?: string; checkedBy?: string } = {}
  ) {
    return this.checklist.mark(id, status, opts);
  }
}

export const releaseStore = new ReleaseStore();
