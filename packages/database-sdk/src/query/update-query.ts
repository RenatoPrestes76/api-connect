import type { Filter } from '../filters/expressions.js';

export interface UpdateQuery {
  readonly type:       'UPDATE';
  readonly table:      string;
  readonly set:        Record<string, unknown>;
  readonly where?:     Filter[];
  readonly returning?: string[];
}
