import { describe, it, expect } from 'vitest';
import {
  cn,
  formatRelative,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  clamp,
  truncate,
  capitalize,
  slugify,
  groupBy,
  sortBy,
  healthToStatus,
  confidenceColor,
  confidenceBg,
  buildQuery,
} from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });
  it('deduplicates tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
  it('handles falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
});

describe('formatRelative', () => {
  it('returns dash for undefined', () => {
    expect(formatRelative(undefined)).toBe('—');
  });
  it('returns string for valid ISO', () => {
    const iso = new Date(Date.now() - 60_000).toISOString();
    expect(formatRelative(iso)).toContain('ago');
  });
  it('returns original string on parse error', () => {
    expect(formatRelative('not-a-date')).toBe('not-a-date');
  });
});

describe('formatDateTime', () => {
  it('returns dash for undefined', () => {
    expect(formatDateTime(undefined)).toBe('—');
  });
  it('formats a known date', () => {
    // 2024-06-15T10:30:00.000Z
    const result = formatDateTime('2024-06-15T10:30:00.000Z');
    expect(result).toMatch(/Jun 2024/);
  });
  it('falls back for invalid ISO', () => {
    expect(formatDateTime('bad')).toBe('bad');
  });
});

describe('formatDuration', () => {
  it('returns dash for undefined', () => {
    expect(formatDuration(undefined)).toBe('—');
  });
  it('formats ms', () => {
    expect(formatDuration(500)).toBe('500ms');
  });
  it('formats seconds', () => {
    expect(formatDuration(2500)).toBe('2.5s');
  });
  it('formats minutes', () => {
    expect(formatDuration(90000)).toBe('1.5m');
  });
  it('boundary: 1000ms → seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s');
  });
});

describe('formatNumber', () => {
  it('returns dash for undefined', () => {
    expect(formatNumber(undefined)).toBe('—');
  });
  it('formats number with locale separators', () => {
    const result = formatNumber(1_000_000);
    expect(result).toMatch(/1.000.000|1,000,000/);
  });
  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatPercent', () => {
  it('returns 0% for zero total', () => {
    expect(formatPercent(5, 0)).toBe('0%');
  });
  it('calculates percent', () => {
    expect(formatPercent(1, 4)).toBe('25%');
  });
  it('rounds correctly', () => {
    expect(formatPercent(1, 3)).toBe('33%');
  });
});

describe('clamp', () => {
  it('clamps below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it('clamps above max', () => {
    expect(clamp(20, 0, 10)).toBe(10);
  });
  it('returns value within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('handles equal bounds', () => {
    expect(clamp(5, 5, 5)).toBe(5);
  });
});

describe('truncate', () => {
  it('returns original when short enough', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
  it('truncates with ellipsis', () => {
    expect(truncate('hello world', 7)).toBe('hello …');
  });
  it('exact length is not truncated', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });
  it('lowercases rest', () => {
    expect(capitalize('hELLO')).toBe('Hello');
  });
  it('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });
});

describe('slugify', () => {
  it('lowercases and replaces spaces', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });
  it('strips leading/trailing dashes', () => {
    expect(slugify(' hello ')).toBe('hello');
  });
  it('collapses multiple special chars', () => {
    expect(slugify('foo--bar!!baz')).toBe('foo-bar-baz');
  });
});

describe('groupBy', () => {
  it('groups by key', () => {
    const input = [
      { g: 'a', v: 1 },
      { g: 'b', v: 2 },
      { g: 'a', v: 3 },
    ];
    const result = groupBy(input, (x) => x.g);
    expect(result['a']).toHaveLength(2);
    expect(result['b']).toHaveLength(1);
  });
  it('returns empty object for empty array', () => {
    expect(groupBy([], (x: string) => x)).toEqual({});
  });
});

describe('sortBy', () => {
  const arr = [{ n: 'b' }, { n: 'a' }, { n: 'c' }];
  it('sorts ascending by default', () => {
    expect(sortBy(arr, (x) => x.n).map((x) => x.n)).toEqual(['a', 'b', 'c']);
  });
  it('sorts descending', () => {
    expect(sortBy(arr, (x) => x.n, 'desc').map((x) => x.n)).toEqual(['c', 'b', 'a']);
  });
  it('does not mutate original', () => {
    const copy = [...arr];
    sortBy(arr, (x) => x.n);
    expect(arr).toEqual(copy);
  });
});

describe('healthToStatus', () => {
  it('maps healthy', () => {
    expect(healthToStatus('healthy')).toBe('healthy');
  });
  it('maps degraded', () => {
    expect(healthToStatus('DEGRADED')).toBe('degraded');
  });
  it('maps unhealthy', () => {
    expect(healthToStatus('Unhealthy')).toBe('unhealthy');
  });
  it('unknown for anything else', () => {
    expect(healthToStatus('OFFLINE')).toBe('unknown');
  });
});

describe('confidenceColor', () => {
  it('emerald for >= 75', () => {
    expect(confidenceColor(75)).toBe('text-emerald-700');
    expect(confidenceColor(100)).toBe('text-emerald-700');
  });
  it('amber for 50-74', () => {
    expect(confidenceColor(50)).toBe('text-amber-600');
    expect(confidenceColor(74)).toBe('text-amber-600');
  });
  it('rose for < 50', () => {
    expect(confidenceColor(49)).toBe('text-rose-600');
    expect(confidenceColor(0)).toBe('text-rose-600');
  });
});

describe('confidenceBg', () => {
  it('emerald bg for >= 75', () => {
    expect(confidenceBg(80)).toBe('bg-emerald-500');
  });
  it('amber bg for 50-74', () => {
    expect(confidenceBg(60)).toBe('bg-amber-400');
  });
  it('rose bg for < 50', () => {
    expect(confidenceBg(30)).toBe('bg-rose-400');
  });
});

describe('buildQuery', () => {
  it('returns empty string for empty params', () => {
    expect(buildQuery({})).toBe('');
  });
  it('builds query string', () => {
    const q = buildQuery({ a: '1', b: '2' });
    expect(q).toBe('?a=1&b=2');
  });
  it('omits undefined and empty string values', () => {
    const q = buildQuery({ a: '1', b: undefined, c: '' });
    expect(q).toBe('?a=1');
  });
  it('encodes special characters', () => {
    const q = buildQuery({ q: 'hello world' });
    expect(q).toBe('?q=hello%20world');
  });
  it('includes boolean and number values', () => {
    const q = buildQuery({ flag: true, count: 5 });
    expect(q).toBe('?flag=true&count=5');
  });
});
