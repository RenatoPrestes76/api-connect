import type { Filter } from '../filters/expressions.js';
import type { OrderBy, Join } from '../filters/expressions.js';

export interface SelectQuery {
  readonly type:     'SELECT';
  readonly table:    string;
  readonly columns:  string[];
  readonly where?:   Filter[];
  readonly orderBy?: OrderBy[];
  readonly limit?:   number;
  readonly offset?:  number;
  readonly joins?:   Join[];
}
