import type { DialectGenerator } from './dialect-generator.js';

export const firebirdGenerator: DialectGenerator = {
  dialect: 'FIREBIRD',
  quoteIdentifier: (name) => `"${name.replace(/"/g, '""')}"`,
  placeholder: () => '?',
  todayPlusDays: (days) => `CURRENT_DATE + ${days}`,
  // Firebird injects pagination keywords right after SELECT rather than appending them.
  paginate: (selectSql, orderBySql, limit, offset) => {
    const withPagination = selectSql.replace(/^SELECT /i, `SELECT FIRST ${limit} SKIP ${offset} `);
    return orderBySql ? `${withPagination} ${orderBySql}` : withPagination;
  },
};
