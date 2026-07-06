export interface RawQuery {
  readonly type:    'RAW';
  readonly sql:     string;
  readonly params?: unknown[];
}
