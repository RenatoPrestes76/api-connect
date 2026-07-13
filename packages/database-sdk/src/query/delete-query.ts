import type { Filter } from '../filters/expressions.js';

export interface DeleteQuery {
  readonly type: 'DELETE';
  readonly table: string;
  readonly where?: Filter[];
  readonly returning?: string[];
}
