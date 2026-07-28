import type {
  CanonicalBusinessModel,
  CBMEntity,
  CBMField,
  CBMStatistics,
  CBLDomainKind,
} from '@seltriva/semantic-engine';

export interface SerializedField {
  id: string;
  cblTerm: string;
  fieldKind: string;
  sourceName: string;
  nullable: boolean;
  confidence: number;
  mappingStatus: string;
}

export interface SerializedEntity {
  id: string;
  cblTerm: string;
  entityKind: string;
  domain: CBLDomainKind;
  sourceName: string;
  sourceEntityId: string | undefined;
  primaryKeyFields: string[];
  confidence: number;
  mappingStatus: string;
  metadata: Record<string, unknown> | undefined;
  fields: SerializedField[];
}

export interface SerializedModel {
  id: string;
  name: string;
  description: string | undefined;
  version: string;
  domain: CBLDomainKind;
  confidence: number;
  statistics: CBMStatistics;
  createdAt: Date;
  updatedAt: Date;
  entities: SerializedEntity[];
}

export interface SerializedModelSummary {
  id: string;
  name: string;
  version: string;
  domain: CBLDomainKind;
  confidence: number;
  statistics: CBMStatistics;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeField(field: CBMField): SerializedField {
  return {
    id: field.id,
    cblTerm: field.cblTerm,
    fieldKind: field.fieldKind,
    sourceName: field.sourceName,
    nullable: field.nullable,
    confidence: field.confidence,
    mappingStatus: field.mappingStatus,
  };
}

export function serializeEntity(entity: CBMEntity): SerializedEntity {
  return {
    id: entity.id,
    cblTerm: entity.cblTerm,
    entityKind: entity.entityKind,
    domain: entity.domain,
    sourceName: entity.sourceName,
    sourceEntityId: entity.sourceEntityId,
    primaryKeyFields: entity.primaryKeyFields,
    confidence: entity.confidence,
    mappingStatus: entity.mappingStatus,
    metadata: entity.metadata,
    fields: entity.fields.map(serializeField),
  };
}

export function serializeModel(model: CanonicalBusinessModel): SerializedModel {
  return {
    id: model.id,
    name: model.name,
    description: model.description,
    version: model.version,
    domain: model.domain,
    confidence: model.confidence,
    statistics: model.statistics,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    entities: model.entities.map(serializeEntity),
  };
}

export function serializeModelSummary(model: CanonicalBusinessModel): SerializedModelSummary {
  return {
    id: model.id,
    name: model.name,
    version: model.version,
    domain: model.domain,
    confidence: model.confidence,
    statistics: model.statistics,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
}
