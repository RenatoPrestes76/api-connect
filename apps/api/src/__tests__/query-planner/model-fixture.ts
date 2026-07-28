import { randomUUID } from 'node:crypto';
import type {
  CanonicalBusinessModel,
  CBLEntityKind,
  CBLFieldKind,
  CBMEntity,
  CBMField,
} from '@seltriva/semantic-engine';
import { cblEntityTerm, cblFieldTerm } from '@seltriva/semantic-engine';

function field(fieldKind: CBLFieldKind, sourceName: string): CBMField {
  return {
    id: randomUUID(),
    cblTerm: cblFieldTerm(fieldKind),
    fieldKind,
    sourceName,
    nullable: true,
    confidence: 90,
    mappingStatus: 'confirmed',
  };
}

function entity(entityKind: CBLEntityKind, sourceName: string, fields: CBMField[]): CBMEntity {
  return {
    id: randomUUID(),
    cblTerm: cblEntityTerm(entityKind),
    entityKind,
    domain: 'catalog',
    sourceName,
    fields,
    primaryKeyFields: ['id'],
    confidence: 100,
    mappingStatus: 'confirmed',
  };
}

/**
 * A hand-built CanonicalBusinessModel used only to unit-test the query
 * planner's own resolution/validation logic in isolation — deliberately
 * richer than what the real ATHENA pipeline currently produces (e.g. it
 * includes a MINIMUM_QUANTITY field, which nothing in ATHENA's FieldRole
 * vocabulary can tag automatically yet) so every operator/relationship
 * validation branch has something real to exercise.
 */
export function buildTestCanonicalModel(organizationId: string): CanonicalBusinessModel {
  const product = entity('PRODUCT', 'produtos', [
    field('ID', 'id'),
    field('NAME', 'nome'),
    field('BARCODE', 'codigo_barras'),
    field('SALE_PRICE', 'preco_venda'),
    field('EXPIRATION_DATE', 'data_validade'),
    field('QUANTITY', 'quantidade'),
  ]);
  const inventory = entity('INVENTORY', 'estoque', [
    field('ID', 'id'),
    field('QUANTITY', 'quantidade'),
    field('MINIMUM_QUANTITY', 'quantidade_minima'),
  ]);
  const branch = entity('BRANCH', 'filiais', [field('ID', 'id'), field('NAME', 'nome')]);
  const category = entity('CATEGORY', 'categorias', [field('ID', 'id'), field('NAME', 'nome')]);

  const now = new Date();
  return {
    id: randomUUID(),
    name: organizationId,
    version: '1.0.0',
    entities: [product, inventory, branch, category],
    relationships: [],
    domain: 'catalog',
    statistics: {
      totalEntities: 4,
      mappedEntities: 4,
      unmappedEntities: 0,
      totalFields:
        product.fields.length +
        inventory.fields.length +
        branch.fields.length +
        category.fields.length,
      mappedFields: 0,
      unmappedFields: 0,
      averageConfidence: 95,
      pendingValidationCount: 0,
    },
    confidence: 95,
    createdAt: now,
    updatedAt: now,
  };
}
