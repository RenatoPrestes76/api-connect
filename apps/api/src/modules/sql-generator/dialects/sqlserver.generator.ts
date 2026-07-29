import type { DialectGenerator } from './dialect-generator.js';

export const sqlServerGenerator: DialectGenerator = {
  dialect: 'SQLSERVER',
  quoteIdentifier: (name) => `[${name.replace(/]/g, ']]')}]`,
  placeholder: (index) => `@p${index}`,
  todayPlusDays: (days) => `DATEADD(day, ${days}, GETDATE())`,
  paginate: (selectSql, orderBySql, limit, offset) => {
    const order = orderBySql || 'ORDER BY (SELECT NULL)';
    return `${selectSql} ${order} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
  },
};
