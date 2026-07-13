/**
 * ConflictResolver — handles duplicate record situations during dispatch.
 *
 * Strategies:
 *  SKIP       — discard the incoming record; keep what's in the cloud
 *  OVERWRITE  — replace cloud record with incoming
 *  MERGE      — merge fields; incoming wins on key conflict
 *  VERSION    — compare version/updated_at; higher version wins
 *  CUSTOM     — user-supplied resolver function
 */
import type { ConflictResolutionStrategy, SyncRecord } from '../types/index.js';

export interface ConflictContext {
  readonly schema: string;
  readonly table: string;
  readonly incoming: SyncRecord;
  readonly existing: SyncRecord;
  readonly strategy: ConflictResolutionStrategy;
}

export interface ConflictResolutionResult {
  readonly action: 'SKIP' | 'WRITE';
  readonly record: SyncRecord;
  readonly strategy: ConflictResolutionStrategy;
  readonly reason: string;
}

export type CustomResolverFn = (ctx: ConflictContext) => ConflictResolutionResult;

export class ConflictResolver {
  private _customResolvers = new Map<string, CustomResolverFn>();

  registerCustom(tableKey: string, resolver: CustomResolverFn): void {
    this._customResolvers.set(tableKey, resolver);
  }

  resolve(ctx: ConflictContext): ConflictResolutionResult {
    switch (ctx.strategy) {
      case 'SKIP':
        return {
          action: 'SKIP',
          record: ctx.existing,
          strategy: 'SKIP',
          reason: 'Incoming record skipped; existing record preserved',
        };

      case 'OVERWRITE':
        return {
          action: 'WRITE',
          record: ctx.incoming,
          strategy: 'OVERWRITE',
          reason: 'Existing record overwritten with incoming',
        };

      case 'MERGE': {
        const merged: Record<string, unknown> = { ...ctx.existing };
        for (const [k, v] of Object.entries(ctx.incoming)) {
          if (v !== null && v !== undefined) {
            merged[k] = v;
          }
        }
        return {
          action: 'WRITE',
          record: merged as SyncRecord,
          strategy: 'MERGE',
          reason: 'Records merged; incoming fields overwrite existing where non-null',
        };
      }

      case 'VERSION': {
        const incomingVersion = this._extractVersion(ctx.incoming);
        const existingVersion = this._extractVersion(ctx.existing);

        if (incomingVersion > existingVersion) {
          return {
            action: 'WRITE',
            record: ctx.incoming,
            strategy: 'VERSION',
            reason: `Incoming version (${incomingVersion}) > existing (${existingVersion})`,
          };
        }
        return {
          action: 'SKIP',
          record: ctx.existing,
          strategy: 'VERSION',
          reason: `Existing version (${existingVersion}) >= incoming (${incomingVersion}); skip`,
        };
      }

      case 'CUSTOM': {
        const key = `${ctx.schema}.${ctx.table}`;
        const resolver = this._customResolvers.get(key) ?? this._customResolvers.get('*');
        if (!resolver) {
          return {
            action: 'SKIP',
            record: ctx.existing,
            strategy: 'CUSTOM',
            reason: 'No custom resolver registered; defaulting to SKIP',
          };
        }
        return resolver(ctx);
      }

      default:
        return {
          action: 'SKIP',
          record: ctx.existing,
          strategy: ctx.strategy,
          reason: `Unknown strategy "${ctx.strategy as string}"; defaulting to SKIP`,
        };
    }
  }

  private _extractVersion(record: SyncRecord): number {
    // Try common version columns
    const versionKeys = [
      'version',
      'versao',
      '_version',
      'row_version',
      'updated_at',
      'atualizado_em',
    ];
    for (const k of versionKeys) {
      const v = record[k];
      if (v == null) continue;
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'number') return v;
      const parsed = Date.parse(String(v));
      if (!isNaN(parsed)) return parsed;
      const num = Number(v);
      if (!isNaN(num)) return num;
    }
    return 0;
  }
}
