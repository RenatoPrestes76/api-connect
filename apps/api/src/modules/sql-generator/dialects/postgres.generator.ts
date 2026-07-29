import type { DialectGenerator } from './dialect-generator.js';

export const postgresGenerator: DialectGenerator = {
  dialect: 'POSTGRESQL',
  quoteIdentifier: (name) => `"${name.replace(/"/g, '""')}"`,
  placeholder: (index) => `$${index}`,
  todayPlusDays: (days) => `CURRENT_DATE + INTERVAL '${days} days'`,
  paginate: (selectSql, orderBySql, limit, offset) => {
    const order = orderBySql ? ` ${orderBySql}` : '';
    return `${selectSql}${order} LIMIT ${limit} OFFSET ${offset}`;
  },
};
