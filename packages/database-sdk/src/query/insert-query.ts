export interface InsertQuery {
  readonly type:       'INSERT';
  readonly table:      string;
  readonly values:     Record<string, unknown>[];
  readonly returning?: string[];
}
