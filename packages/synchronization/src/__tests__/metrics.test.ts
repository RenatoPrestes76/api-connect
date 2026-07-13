import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../metrics/metrics-collector.js';
import { asSyncJobId } from '../types/index.js';

const JOB = asSyncJobId('job-metrics-001');

describe('MetricsCollector', () => {
  let m: MetricsCollector;

  beforeEach(() => {
    m = new MetricsCollector(JOB, 'FULL');
  });

  it('starts with zero metrics', () => {
    const metrics = m.metrics();
    expect(metrics.totalRecords).toBe(0);
    expect(metrics.syncedRecords).toBe(0);
    expect(metrics.failedRecords).toBe(0);
    expect(metrics.bytesProcessed).toBe(0);
  });

  it('recordSynced accumulates counts and bytes', () => {
    m.startTable('public', 'produto');
    m.recordSynced('public', 'produto', 500, 1024);
    m.recordSynced('public', 'produto', 300, 512);
    const metrics = m.metrics();
    expect(metrics.syncedRecords).toBe(800);
    expect(metrics.bytesProcessed).toBe(1536);
  });

  it('recordFailed accumulates failed count', () => {
    m.startTable('public', 'produto');
    m.recordFailed('public', 'produto', 10);
    m.recordFailed('public', 'produto', 5);
    expect(m.metrics().failedRecords).toBe(15);
  });

  it('startTable and completeTable track table-level metrics', () => {
    m.startTable('public', 'produto');
    m.recordSynced('public', 'produto', 100, 512);
    m.completeTable('public', 'produto');

    const metrics = m.metrics();
    const tableMetrics = metrics.tables.find((t) => t.schema === 'public' && t.table === 'produto');
    expect(tableMetrics?.recordsSynced).toBe(100);
    expect(tableMetrics?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('batchDispatched increments batch count', () => {
    m.startTable('public', 'produto');
    m.batchDispatched('public', 'produto', 1000, 400);
    expect(m.metrics().totalBatches).toBe(1);
  });

  it('complete() sets completedAt and COMPLETED status', () => {
    m.startTable('public', 't');
    m.recordSynced('public', 't', 1, 1);
    m.complete();
    const metrics = m.metrics();
    expect(metrics.completedAt).toBeDefined();
    expect(metrics.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('avgRecordsPerSec is a number', () => {
    m.startTable('public', 'produto');
    m.recordSynced('public', 'produto', 1000, 1024);
    const metrics = m.metrics();
    expect(typeof metrics.avgRecordsPerSec).toBe('number');
  });

  it('conflictDetected and conflictResolved are counted', () => {
    m.conflictDetected();
    m.conflictDetected();
    m.conflictResolved();
    const metrics = m.metrics();
    expect(metrics.conflictsDetected).toBe(2);
    expect(metrics.conflictsResolved).toBe(1);
  });

  it('retryOccurred increments retryCount', () => {
    m.retryOccurred();
    m.retryOccurred();
    expect(m.metrics().retryCount).toBe(2);
  });

  it('progress() returns percentage and ETA', () => {
    m.startTable('public', 'produto');
    m.setTotalRecords(1000);
    m.recordSynced('public', 'produto', 500, 512);
    const p = m.progress();
    expect(p.progressPercent).toBe(50);
    expect(p.totalRecords).toBe(1000);
  });

  it('recordSkipped increments skippedRecords', () => {
    m.startTable('public', 'produto');
    m.recordSkipped('public', 'produto', 20);
    expect(m.metrics().skippedRecords).toBe(20);
  });
});
