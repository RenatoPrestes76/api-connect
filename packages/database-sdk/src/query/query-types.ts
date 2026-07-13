// Re-export filter primitives
export type { FilterOperator, SimpleFilterOperator } from '../filters/operators.js';
export type {
  Filter,
  SimpleFilter,
  CompoundFilter,
  OrderBy,
  Join,
} from '../filters/expressions.js';

// Re-export individual query types
export type { SelectQuery } from './select-query.js';
export type { InsertQuery } from './insert-query.js';
export type { UpdateQuery } from './update-query.js';
export type { DeleteQuery } from './delete-query.js';
export type { RawQuery } from './raw-query.js';

// Query union type
import type { SelectQuery } from './select-query.js';
import type { InsertQuery } from './insert-query.js';
import type { UpdateQuery } from './update-query.js';
import type { DeleteQuery } from './delete-query.js';
import type { RawQuery } from './raw-query.js';

export type Query = SelectQuery | InsertQuery | UpdateQuery | DeleteQuery | RawQuery;
