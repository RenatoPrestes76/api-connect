export type SimpleFilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'like'
  | 'in'
  | 'isNull'
  | 'isNotNull';

export type FilterOperator = SimpleFilterOperator | 'and' | 'or';
