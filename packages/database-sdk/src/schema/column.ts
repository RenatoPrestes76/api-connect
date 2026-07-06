export interface Column {
  readonly name:          string;
  readonly type:          string;
  readonly nullable:      boolean;
  readonly defaultValue?: unknown;
  readonly isPrimaryKey:  boolean;
  readonly isForeignKey:  boolean;
  readonly isUnique:      boolean;
  readonly maxLength?:    number;
  readonly precision?:    number;
  readonly scale?:        number;
}
