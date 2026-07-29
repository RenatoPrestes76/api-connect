import type { DialectGenerator } from './dialect-generator.js';

export const oracleGenerator: DialectGenerator = {
  dialect: 'ORACLE',
  quoteIdentifier: (name) => `"${name.replace(/"/g, '""')}"`,
  placeholder: (index) => `:${index}`,
  todayPlusDays: (days) => `TRUNC(SYSDATE) + ${days}`,
  paginate: (selectSql, orderBySql, limit, offset) => {
    const order = orderBySql ? ` ${orderBySql}` : '';
    return `${selectSql}${order} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
  },
};
