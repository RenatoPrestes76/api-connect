import { randomUUID } from 'node:crypto';
import type { CBLDomainKind, SemanticResult } from '../business-language/index.js';
import { ok } from './result.js';
import type {
  CanonicalBusinessModel,
  CBMBuildSession,
  CBMBuilder,
  CBMEntity,
  CBMRelationship,
  CBMStatistics,
} from './index.js';

function computeStatistics(entities: readonly CBMEntity[]): CBMStatistics {
  const totalEntities = entities.length;
  const mappedEntities = entities.filter(
    (e) => e.mappingStatus === 'confirmed' || e.mappingStatus === 'auto-approved'
  ).length;
  const allFields = entities.flatMap((e) => e.fields);
  const totalFields = allFields.length;
  const mappedFields = allFields.filter(
    (f) => f.mappingStatus === 'confirmed' || f.mappingStatus === 'auto-approved'
  ).length;
  const pendingValidationCount =
    entities.filter((e) => e.mappingStatus === 'pending-validation').length +
    allFields.filter((f) => f.mappingStatus === 'pending-validation').length;
  const confidences = [...entities.map((e) => e.confidence), ...allFields.map((f) => f.confidence)];
  const averageConfidence =
    confidences.length === 0
      ? 0
      : Math.round(confidences.reduce((sum, c) => sum + c, 0) / confidences.length);

  return {
    totalEntities,
    mappedEntities,
    unmappedEntities: totalEntities - mappedEntities,
    totalFields,
    mappedFields,
    unmappedFields: totalFields - mappedFields,
    averageConfidence,
    pendingValidationCount,
  };
}

class CBMBuildSessionImpl implements CBMBuildSession {
  private entities: CBMEntity[] = [];
  private relationships: CBMRelationship[] = [];
  private domain: CBLDomainKind = 'system';
  private readonly description: string | undefined;

  constructor(
    private readonly name: string,
    options?: { description?: string }
  ) {
    this.description = options?.description;
  }

  addEntity(entity: Omit<CBMEntity, 'id'>): CBMBuildSession {
    this.entities.push({ ...entity, id: randomUUID() });
    return this;
  }

  addRelationship(relationship: Omit<CBMRelationship, 'id'>): CBMBuildSession {
    this.relationships.push({ ...relationship, id: randomUUID() });
    return this;
  }

  setDomain(domain: CBLDomainKind): CBMBuildSession {
    this.domain = domain;
    return this;
  }

  build(): SemanticResult<CanonicalBusinessModel> {
    const now = new Date();
    const statistics = computeStatistics(this.entities);
    const model: CanonicalBusinessModel = {
      id: randomUUID(),
      name: this.name,
      description: this.description,
      version: '1.0.0',
      entities: this.entities,
      relationships: this.relationships,
      domain: this.domain,
      statistics,
      confidence: statistics.averageConfidence,
      createdAt: now,
      updatedAt: now,
    };
    return ok(model);
  }
}

export class CBMBuilderImpl implements CBMBuilder {
  begin(name: string, options?: { description?: string }): CBMBuildSession {
    return new CBMBuildSessionImpl(name, options);
  }
}

export const cbmBuilder = new CBMBuilderImpl();
