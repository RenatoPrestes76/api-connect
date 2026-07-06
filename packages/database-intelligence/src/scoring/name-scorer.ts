/**
 * NameScorer — scores a table based solely on its name.
 *
 * Scoring strategy:
 *  exact match   → 100 pts raw
 *  strong match  →  80 pts raw
 *  medium match  →  50 pts raw
 *  weak match    →  20 pts raw
 *
 * The normalized name (noise prefixes/suffixes stripped) is matched first.
 * Then the raw name is matched (catches cases where prefix IS the signal).
 */
import { ENTITY_PATTERNS, normalizeTableName } from '../knowledge/entity-patterns.js';
import type { EntityType, ScoreMap, ScoringReason } from '../types/index.js';

export interface NameScoreResult {
  readonly scores:  ScoreMap;
  readonly reasons: readonly ScoringReason[];
}

export class NameScorer {
  score(rawTableName: string): NameScoreResult {
    const normalized = normalizeTableName(rawTableName);
    const scores: Record<EntityType, number> = {} as Record<EntityType, number>;
    const reasons: ScoringReason[] = [];

    for (const [entity, patterns] of Object.entries(ENTITY_PATTERNS) as [EntityType, typeof ENTITY_PATTERNS[EntityType]][]) {
      let best = 0;
      let bestReason = '';

      const check = (candidate: string, tiers: typeof patterns) => {
        // Exact match
        if (tiers.exact.includes(candidate)) {
          const pts = 100;
          if (pts > best) { best = pts; bestReason = `table name "${candidate}" exactly matches "${entity}" exact list`; }
        }
        // Strong contains
        for (const p of tiers.strong) {
          if (candidate === p || candidate.includes(p)) {
            const pts = 80;
            if (pts > best) { best = pts; bestReason = `table name "${candidate}" contains strong pattern "${p}" for ${entity}`; }
          }
        }
        // Medium contains
        for (const p of tiers.medium) {
          if (candidate === p || candidate.includes(p)) {
            const pts = 50;
            if (pts > best) { best = pts; bestReason = `table name "${candidate}" contains medium pattern "${p}" for ${entity}`; }
          }
        }
        // Weak contains
        for (const p of tiers.weak) {
          if (candidate === p || candidate.includes(p)) {
            const pts = 20;
            if (pts > best) { best = pts; bestReason = `table name "${candidate}" contains weak pattern "${p}" for ${entity}`; }
          }
        }
      };

      check(normalized, patterns);
      if (best < 80) check(rawTableName.toLowerCase(), patterns);

      if (best > 0) {
        scores[entity] = best;
        reasons.push({ signal: 'table_name', weight: best, detail: bestReason });
      }
    }

    return { scores, reasons };
  }
}
