import type { DialectGenerator } from './dialect-generator.js';

// MariaDB is MySQL-wire/syntax-compatible for everything this generator
// touches (identifiers, placeholders, date arithmetic, pagination) — kept
// as its own file/dialect (not an alias) since the two ERPs are tracked as
// distinct DbType values throughout the rest of the platform, and a real
// MariaDB-specific divergence (e.g. a window-function difference) would
// belong here without touching MySQL's generator.
export const mariadbGenerator: DialectGenerator = {
  dialect: 'MARIADB',
  quoteIdentifier: (name) => `\`${name.replace(/`/g, '``')}\``,
  placeholder: () => '?',
  todayPlusDays: (days) => `DATE_ADD(CURDATE(), INTERVAL ${days} DAY)`,
  paginate: (selectSql, orderBySql, limit, offset) => {
    const order = orderBySql ? ` ${orderBySql}` : '';
    return `${selectSql}${order} LIMIT ${limit} OFFSET ${offset}`;
  },
};
