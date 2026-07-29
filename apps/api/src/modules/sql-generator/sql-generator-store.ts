import { randomUUID } from 'node:crypto';
import { canonicalModelStore } from '../canonical-model/canonical-model-store.js';
import { queryPlannerStore } from '../query-planner/query-planner-store.js';
import { erpConnectivityStore } from '../erp-connectivity/erp-connectivity-store.js';
import { getDialectGenerator } from './dialects/index.js';
import { routeDialect } from './dialect-router.js';
import { resolvePhysicalPlan } from './physical-resolver.js';
import { optimizePlan } from './optimizer.js';
import { renderSql } from './sql-renderer.js';
import type {
  ExplainResult,
  GenerateSqlInput,
  GenerateSqlResult,
  GeneratedQueryRecord,
  LogicalPlanEntity,
  SqlGenerationError,
} from './types.js';

interface PreparedGeneration {
  sql: string;
  parameters: GeneratedQueryRecord['parameters'];
  dialect: GeneratedQueryRecord['dialect'];
  profileId: string;
  canonicalModelId: string;
  canonicalVersion: string;
  organizationId: string;
  queryPlanId: string;
  estimatedCost: number;
  optimizations: string[];
  logicalPlan: ExplainResult['logicalPlan'];
}

function estimateCost(joinCount: number, filterLeafCount: number, hasPagination: boolean): number {
  const base = 10;
  const joinCost = joinCount * 15;
  const filterCost = filterLeafCount * 5;
  const scanPenalty = hasPagination ? 0 : 20;
  return base + joinCost + filterCost + scanPenalty;
}

function countFilterLeaves(nodes: readonly unknown[]): number {
  let count = 0;
  for (const node of nodes) {
    const n = node as { logic?: string; filters?: unknown[] };
    if (n.logic && Array.isArray(n.filters)) count += countFilterLeaves(n.filters);
    else count += 1;
  }
  return count;
}

let _instance: SqlGeneratorStore | null = null;

export class SqlGeneratorStore {
  private queries: GeneratedQueryRecord[] = [];

  static getInstance(): SqlGeneratorStore {
    if (!_instance) _instance = new SqlGeneratorStore();
    return _instance;
  }

  private async prepare(
    input: GenerateSqlInput,
    organizationId: string
  ): Promise<
    { ok: true; prepared: PreparedGeneration } | { ok: false; errors: SqlGenerationError[] }
  > {
    if (!input.queryPlanId) {
      return {
        ok: false,
        errors: [{ code: 'PLAN_NOT_FOUND', message: 'queryPlanId is required' }],
      };
    }
    const plan = queryPlannerStore.getById(input.queryPlanId);
    if (!plan) {
      return {
        ok: false,
        errors: [
          { code: 'PLAN_NOT_FOUND', message: `No query plan found with id "${input.queryPlanId}"` },
        ],
      };
    }
    if (plan.organizationId !== organizationId) {
      return {
        ok: false,
        errors: [
          {
            code: 'PLAN_ORGANIZATION_MISMATCH',
            message: 'This query plan does not belong to this organization',
          },
        ],
      };
    }

    const model = await canonicalModelStore.getModel(plan.canonicalModelId);
    if (!model) {
      return {
        ok: false,
        errors: [
          {
            code: 'CANONICAL_MODEL_NOT_FOUND',
            message: 'The canonical model this plan was built against no longer exists',
          },
        ],
      };
    }

    const resolution = resolvePhysicalPlan(plan, model, input.entityInstanceId);
    if (!resolution.ok) return { ok: false, errors: resolution.errors };

    let dialect = input.dialect;
    if (!dialect) {
      const profile = erpConnectivityStore.getProfile(resolution.resolution.profileId);
      if (!profile) {
        return {
          ok: false,
          errors: [
            {
              code: 'UNKNOWN_DIALECT',
              message: 'Could not determine the target ERP connection profile',
            },
          ],
        };
      }
      dialect = routeDialect(profile.dbType);
    }
    if (!dialect) {
      return {
        ok: false,
        errors: [
          {
            code: 'UNSUPPORTED_DIALECT',
            message: 'No SQL dialect could be determined for this ERP connection',
          },
        ],
      };
    }

    const optimized = optimizePlan(plan);
    const generator = getDialectGenerator(dialect);
    const rendered = renderSql(optimized, plan.pagination, resolution.resolution, generator);
    if (!rendered.ok) return { ok: false, errors: rendered.errors };

    const logicalPlan: ExplainResult['logicalPlan'] = {
      entities: [
        {
          alias: null,
          canonicalEntity: plan.rootEntity,
          physicalSchema: resolution.resolution.rootPhysicalSchema,
          physicalTable: resolution.resolution.rootPhysicalTable,
        },
        ...resolution.resolution.joins.map(
          (j): LogicalPlanEntity => ({
            alias: j.alias,
            canonicalEntity: j.entity,
            physicalSchema: j.physicalSchema,
            physicalTable: j.physicalTable,
            joinCondition: `${resolution.resolution.rootPhysicalTable}.${j.onLeftColumn} = ${j.physicalTable}.${j.onRightColumn}`,
          })
        ),
      ],
      filterCount: countFilterLeaves(optimized.filters),
      projectionCount: optimized.projections.length,
      optimizations: optimized.notes,
    };

    return {
      ok: true,
      prepared: {
        sql: rendered.sql,
        parameters: rendered.parameters,
        dialect,
        profileId: resolution.resolution.profileId,
        canonicalModelId: model.id,
        canonicalVersion: model.version,
        organizationId,
        queryPlanId: plan.id,
        estimatedCost: estimateCost(
          optimized.joins.length,
          countFilterLeaves(optimized.filters),
          !!plan.pagination
        ),
        optimizations: [...optimized.notes],
        logicalPlan,
      },
    };
  }

  async explain(
    input: GenerateSqlInput,
    organizationId: string
  ): Promise<{ ok: true; result: ExplainResult } | { ok: false; errors: SqlGenerationError[] }> {
    const prepared = await this.prepare(input, organizationId);
    if (!prepared.ok) return prepared;
    return {
      ok: true,
      result: {
        sql: prepared.prepared.sql,
        parameters: prepared.prepared.parameters,
        dialect: prepared.prepared.dialect,
        estimatedCost: prepared.prepared.estimatedCost,
        logicalPlan: prepared.prepared.logicalPlan,
      },
    };
  }

  async generate(
    input: GenerateSqlInput,
    organizationId: string,
    actorEmail: string
  ): Promise<GenerateSqlResult> {
    const prepared = await this.prepare(input, organizationId);
    if (!prepared.ok) return { ok: false, errors: prepared.errors };

    const record: GeneratedQueryRecord = {
      id: randomUUID(),
      organizationId: prepared.prepared.organizationId,
      queryPlanId: prepared.prepared.queryPlanId,
      canonicalModelId: prepared.prepared.canonicalModelId,
      canonicalVersion: prepared.prepared.canonicalVersion,
      profileId: prepared.prepared.profileId,
      dialect: prepared.prepared.dialect,
      sql: prepared.prepared.sql,
      parameters: prepared.prepared.parameters,
      estimatedCost: prepared.prepared.estimatedCost,
      optimizations: prepared.prepared.optimizations,
      generatedAt: new Date().toISOString(),
      createdBy: actorEmail,
    };
    this.queries.push(record);
    return { ok: true, record };
  }

  getById(id: string): GeneratedQueryRecord | undefined {
    return this.queries.find((q) => q.id === id);
  }

  history(
    organizationId: string,
    limit = 50,
    offset = 0
  ): { total: number; queries: GeneratedQueryRecord[] } {
    const forOrg = this.queries
      .filter((q) => q.organizationId === organizationId)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    return { total: forOrg.length, queries: forOrg.slice(offset, offset + limit) };
  }
}

export const sqlGeneratorStore = SqlGeneratorStore.getInstance();
