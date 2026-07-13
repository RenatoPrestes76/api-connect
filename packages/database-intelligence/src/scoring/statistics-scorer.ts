/**
 * StatisticsScorer — uses row counts and table size as signals.
 *
 * Key heuristics:
 *  - Very few rows (< 20) → likely LOOKUP / CONFIGURATION
 *  - Few rows (20–500)    → likely LOOKUP / CATEGORY / BRANCH / USER
 *  - Moderate rows        → likely PRODUCT / SUPPLIER / CUSTOMER
 *  - Many rows (> 50k)    → likely SALE / MOVEMENT / LOG / AUDIT
 *  - Huge rows (> 500k)   → almost certainly MOVEMENT / LOG / FISCAL
 */
import type { EntityType, ScoreMap, ScoringReason, TableStatsInput } from '../types/index.js';

export interface StatisticsScoreResult {
  readonly scores: ScoreMap;
  readonly reasons: readonly ScoringReason[];
  readonly estimatedRows: number | null;
}

interface RowCountTier {
  readonly min: number;
  readonly max: number;
  readonly signals: Array<[EntityType, number]>;
  readonly label: string;
}

const ROW_COUNT_TIERS: readonly RowCountTier[] = [
  {
    min: 0,
    max: 20,
    label: 'tiny (0–20 rows)',
    signals: [
      ['LOOKUP', 70],
      ['CONFIGURATION', 60],
      ['PERMISSION', 40],
    ],
  },
  {
    min: 21,
    max: 500,
    label: 'small (21–500 rows)',
    signals: [
      ['LOOKUP', 50],
      ['CATEGORY', 50],
      ['BRANCH', 40],
      ['USER', 30],
      ['CONFIGURATION', 30],
    ],
  },
  {
    min: 501,
    max: 10_000,
    label: 'medium (501–10k rows)',
    signals: [
      ['CATEGORY', 30],
      ['SUPPLIER', 40],
      ['USER', 30],
      ['PRODUCT', 20],
    ],
  },
  {
    min: 10_001,
    max: 100_000,
    label: 'large (10k–100k rows)',
    signals: [
      ['PRODUCT', 40],
      ['CUSTOMER', 40],
      ['SUPPLIER', 30],
    ],
  },
  {
    min: 100_001,
    max: 1_000_000,
    label: 'very large (100k–1M rows)',
    signals: [
      ['SALE', 50],
      ['MOVEMENT', 50],
      ['PRODUCT', 20],
      ['CUSTOMER', 20],
    ],
  },
  {
    min: 1_000_001,
    max: Infinity,
    label: 'huge (> 1M rows)',
    signals: [
      ['MOVEMENT', 60],
      ['LOG', 60],
      ['AUDIT', 50],
      ['FISCAL', 40],
      ['SALE', 40],
    ],
  },
];

export class StatisticsScorer {
  score(stats: TableStatsInput | undefined): StatisticsScoreResult {
    const rows = stats?.estimatedRows ?? null;

    if (rows === null) {
      return { scores: {}, reasons: [], estimatedRows: null };
    }

    const scores: ScoreMap = {};
    const reasons: ScoringReason[] = [];

    for (const tier of ROW_COUNT_TIERS) {
      if (rows >= tier.min && rows <= tier.max) {
        for (const [entity, pts] of tier.signals) {
          scores[entity] = (scores[entity] ?? 0) + pts;
          reasons.push({
            signal: 'row_count',
            weight: pts,
            detail: `${rows.toLocaleString()} rows (${tier.label}) adds ${pts}pts to ${entity}`,
          });
        }
        break;
      }
    }

    return { scores, reasons, estimatedRows: rows };
  }
}
