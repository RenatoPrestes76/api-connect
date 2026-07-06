export type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';

export interface Relation {
  readonly fromTable:  string;
  readonly fromColumn: string;
  readonly toTable:    string;
  readonly toColumn:   string;
  readonly type:       RelationType;
}
