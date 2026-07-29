import type { DialectGenerator } from './dialect-generator.js';

export const sqliteGenerator: DialectGenerator = {
  dialect: 'SQLITE',
  quoteIdentifier: (name) => `"${name.replace(/"/g, '""')}"`,
  placeholder: () => '?',
  todayPlusDays: (days) => `date('now', '${days >= 0 ? '+' : ''}${days} days')`,
  paginate: (selectSql, orderBySql, limit, offset) => {
    const order = orderBySql ? ` ${orderBySql}` : '';
    return `${selectSql}${order} LIMIT ${limit} OFFSET ${offset}`;
  },
};
