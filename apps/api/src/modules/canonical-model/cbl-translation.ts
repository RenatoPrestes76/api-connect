import type { CBLEntityKind, CBLFieldKind, CBLDomainKind } from '@seltriva/semantic-engine';
import { CBL_ENTITY_DOMAINS } from '@seltriva/semantic-engine';
import type { FieldRole } from '@seltriva/database-intelligence';
import type { BusinessEntityType } from '../semantic-mapping/types.js';

/**
 * Translates semantic-mapping's (Sprint 46.10) Portuguese business
 * vocabulary into the canonical English CBL vocabulary that every future
 * Atlas module (queries, commands, automations, AI) is meant to speak —
 * regardless of which ERP a table/column originally came from.
 *
 * This translator is intentionally a static, deterministic lookup table —
 * no heuristics, no scoring, no inference. All uncertainty was already
 * resolved upstream (ATHENA's scoring engine, then a human approval in
 * semantic-mapping); this layer only ever restates an already-decided
 * classification in the canonical vocabulary.
 *
 * Sprint 46.11 — closes the ATLAS 46.10 reservation by wiring the 5
 * additional business entities semantic-mapping already recognizes
 * (VARIANTE_PRODUTO, DEPOSITO, PAGAMENTO, FUNCIONARIO, LOTE) into CBL.
 * Four of the five already had a matching CBLEntityKind (PRODUCT_VARIANT,
 * WAREHOUSE, PAYMENT, EMPLOYEE) — reused as-is, per the "don't create
 * parallel names" rule. Only INVENTORY_LOT was genuinely new (see
 * business-language/index.ts) since no lot/batch concept existed in CBL yet.
 */
export const BUSINESS_TO_CBL_ENTITY: Readonly<Partial<Record<BusinessEntityType, CBLEntityKind>>> =
  {
    PRODUTO: 'PRODUCT',
    ESTOQUE: 'INVENTORY',
    MOVIMENTACAO_ESTOQUE: 'INVENTORY_MOVEMENT',
    CLIENTE: 'CUSTOMER',
    FORNECEDOR: 'SUPPLIER',
    COMPRA: 'PURCHASE_ORDER',
    ITEM_COMPRA: 'PURCHASE_ORDER_LINE',
    VENDA: 'ORDER',
    ITEM_VENDA: 'ORDER_LINE',
    FILIAL: 'BRANCH',
    USUARIO: 'EMPLOYEE',
    OPERADOR: 'EMPLOYEE',
    PRECO: 'PRICE_LIST_ITEM',
    PROMOCAO: 'PROMOTION',
    CATEGORIA: 'CATEGORY',
    MARCA: 'BRAND',
    UNIDADE: 'UNIT_OF_MEASURE',
    INVENTARIO: 'INVENTORY_COUNT',
    VARIANTE_PRODUTO: 'PRODUCT_VARIANT',
    DEPOSITO: 'WAREHOUSE',
    PAGAMENTO: 'PAYMENT',
    // FUNCIONARIO joins USUARIO and OPERADOR as a third source feeding the
    // same canonical EMPLOYEE concept — this is not a textual alias, it's
    // the same convergence already established and shipped for
    // USUARIO/OPERADOR: three structurally different source tables (system
    // login accounts, point-of-sale operators, and dedicated HR employee
    // records) all describe "a person working for the organization" from
    // CBL's point of view. Nothing is collapsed: canonical-model-builder.ts
    // keeps one CBMEntity per source table (tagged by sourceName), it only
    // shares the same `entityKind`/domain — exactly like two ERPs' PRODUCT
    // tables already do (see its own "label uniformly, don't merge" doc).
    FUNCIONARIO: 'EMPLOYEE',
    // LOTE is the one genuinely new CBL concept this sprint introduces
    // (INVENTORY_LOT) — a lot/batch is related to PRODUTO and ESTOQUE but is
    // neither: it is never collapsed into INVENTORY or PRODUCT.
    LOTE: 'INVENTORY_LOT',
    // NAO_MAPEADO deliberately has no CBL counterpart — tables semantic-mapping
    // couldn't confidently classify never enter the canonical model. This must
    // keep holding for any future unrecognized entity too: an absent key here
    // always means "skip it" (see canonical-model-builder.ts's `if (!cblKind)
    // continue`), never a silent fallback to some existing canonical entity.
  };

// ─── Reverse translation ────────────────────────────────────────────────────
//
// No CBLEntityKind -> BusinessEntityType reverse map exists anywhere in this
// codebase (verified: BUSINESS_TO_CBL_ENTITY above is the only translation
// table, and nothing consumes a CBLEntityKind to look up a BusinessEntityType).
// The canonical model is a one-way projection — once a table becomes a CBM
// entity, Atlas never needs to walk back to which Portuguese business
// vocabulary term produced it (that lineage is already preserved separately,
// in the semantic-mapping MappingRecord itself, keyed by profileId/schema/
// table). Building a reverse map here would be speculative: EMPLOYEE alone
// would already be ambiguous (USUARIO, OPERADOR, or FUNCIONARIO?) with no
// real caller to decide the tie-break. Per Sprint 46.11 scope, this is
// deliberately not built.

export function cblDomainForEntity(kind: CBLEntityKind): CBLDomainKind {
  return CBL_ENTITY_DOMAINS[kind];
}

const FIELD_ROLE_TO_CBL_FIELD: Readonly<Partial<Record<FieldRole, CBLFieldKind>>> = {
  IDENTIFIER: 'ID',
  CODE: 'CODE',
  SKU: 'SKU',
  EAN: 'EAN',
  NAME: 'NAME',
  DESCRIPTION: 'DESCRIPTION',
  PRICE: 'LIST_PRICE',
  COST_PRICE: 'COST_PRICE',
  SALE_PRICE: 'SALE_PRICE',
  MARGIN: 'MARGIN',
  QUANTITY: 'QUANTITY',
  BALANCE: 'STOCK_BALANCE',
  WEIGHT: 'WEIGHT',
  EXPIRY_DATE: 'EXPIRATION_DATE',
  MANUFACTURE_DATE: 'MANUFACTURE_DATE',
  STATUS: 'STATUS',
  BRAND: 'BRAND',
  TIMESTAMP_CREATED: 'CREATED_AT',
  TIMESTAMP_UPDATED: 'UPDATED_AT',
  SOFT_DELETE: 'IS_DELETED',
  CATEGORY_FK: 'CATEGORY',
  SUPPLIER_FK: 'SUPPLIER',
  BRANCH_FK: 'BRANCH',
  CUSTOMER_FK: 'CUSTOMER',
  PRODUCT_FK: 'PRODUCT',
  // FLAG, FOREIGN_KEY, and UNKNOWN have no reliable single canonical
  // counterpart — fields with those roles are still included in the model
  // (nothing is silently dropped) but flagged mappingStatus: 'unmapped'.
};

export function translateFieldRole(role: FieldRole): CBLFieldKind | null {
  return FIELD_ROLE_TO_CBL_FIELD[role] ?? null;
}
