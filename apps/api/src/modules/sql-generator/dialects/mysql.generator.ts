import type { DialectGenerator } from './dialect-generator.js';

export const mysqlGenerator: DialectGenerator = {
  dialect: 'MYSQL',
  quoteIdentifier: (name) => `\`${name.replace(/`/g, '``')}\``,
  placeholder: () => '?',
  todayPlusDays: (days) => `DATE_ADD(CURDATE(), INTERVAL ${days} DAY)`,
  paginate: (selectSql, orderBySql, limit, offset) => {
    const order = orderBySql ? ` ${orderBySql}` : '';
    return `${selectSql}${order} LIMIT ${limit} OFFSET ${offset}`;
  },
};
