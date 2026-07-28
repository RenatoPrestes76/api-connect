import type { CBLEntityKind, CBLFieldKind, CBLDomainKind } from '@seltriva/semantic-engine';
import { CBL_ENTITY_DOMAINS } from '@seltriva/semantic-engine';
import type { FieldRole } from '@seltriva/database-intelligence';
import type { BusinessEntityType } from '../semantic-mapping/types.js';

/**
 * Translates semantic-mapping's (Sprint 46.10) Portuguese business
 * vocabulary into the canonical English CBL vocabulary that every future
 * Atlas module (queries, commands, automations, AI) is meant to speak —
 * regardless of which ERP a table/column originally came from.
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
    // NAO_MAPEADO deliberately has no CBL counterpart — tables semantic-mapping
    // couldn't confidently classify never enter the canonical model.
  };

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
