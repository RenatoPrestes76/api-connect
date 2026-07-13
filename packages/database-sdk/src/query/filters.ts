// Backward-compat re-export: import directly from filters/expressions.ts for new code.
export {
  equals,
  notEquals,
  greaterThan,
  greaterThanOrEqual,
  lessThan,
  lessThanOrEqual,
  between,
  like,
  inList,
  isNull,
  isNotNull,
  and,
  or,
} from '../filters/expressions.js';
