/**
 * CompositeScorer — combines all signal sources into a single ranked result.
 *
 * Weighting scheme (total budget: 100 units):
 *  - Name:          35%
 *  - Columns:       30%
 *  - Relationships: 20%
 *  - Statistics:    10%
 *  - Sampling:       5%
 *
 * Final score for an entity = weighted average of individual signals,
 * normalized to [0, 100].
 */
import { NameScorer } from './name-scorer.js';
import { ColumnScorer } from './column-scorer.js';
import { RelationshipScorer } from './relationship-scorer.js';
import { StatisticsScorer } from './statistics-scorer.js';
import { SamplingScorer, type SampledColumn } from './sampling-scorer.js';
import type {
  EntityType,
  ScoreMap,
  ScoringReason,
  TableInput,
  AlternativeEntity,
} from '../types/index.js';
import { ALL_ENTITY_TYPES } from '../types/index.js';

const WEIGHT_NAME         = 0.35;
const WEIGHT_COLUMNS      = 0.30;
const WEIGHT_RELATIONSHIP = 0.20;
const WEIGHT_STATISTICS   = 0.10;
const WEIGHT_SAMPLING     = 0.05;

export interface CompositeScoreResult {
  readonly entity:      EntityType;
  readonly confidence:  number;
  readonly reasons:     readonly ScoringReason[];
  readonly alternatives: readonly AlternativeEntity[];
}

export class CompositeScorer {
  private readonly _name         = new NameScorer();
  private readonly _column       = new ColumnScorer();
  private readonly _relationship = new RelationshipScorer();
  private readonly _statistics   = new StatisticsScorer();
  private readonly _sampling     = new SamplingScorer();

  score(
    table: TableInput,
    entityHints: Readonly<Partial<Record<string, EntityType>>>,
    allTables: readonly TableInput[],
    sampledColumns: readonly SampledColumn[] = [],
  ): CompositeScoreResult & { readonly fieldRoles: ReturnType<ColumnScorer['score']>['fieldRoles'] } {
    const nameResult   = this._name.score(table.name);
    const colResult    = this._column.score(table.columns);
    const relResult    = this._relationship.score(table, entityHints, allTables);
    const statResult   = this._statistics.score(table.statistics);
    const sampleResult = this._sampling.score(sampledColumns);

    const allReasons: ScoringReason[] = [
      ...nameResult.reasons,
      ...colResult.reasons,
      ...relResult.reasons,
      ...statResult.reasons,
      ...sampleResult.reasons,
    ];

    // Combine with weights
    const combined: Partial<Record<EntityType, number>> = {};
    for (const entity of ALL_ENTITY_TYPES) {
      if (entity === 'UNKNOWN') continue;

      const nameScore   = nameResult.scores[entity]   ?? 0;
      const colScore    = colResult.scores[entity]    ?? 0;
      const relScore    = relResult.scores[entity]    ?? 0;
      const statScore   = statResult.scores[entity]   ?? 0;
      const sampleScore = sampleResult.scores[entity] ?? 0;

      const composite =
        nameScore   * WEIGHT_NAME +
        colScore    * WEIGHT_COLUMNS +
        relScore    * WEIGHT_RELATIONSHIP +
        statScore   * WEIGHT_STATISTICS +
        sampleScore * WEIGHT_SAMPLING;

      if (composite > 0) {
        combined[entity] = Math.round(Math.min(100, composite));
      }
    }

    // Rank results
    const ranked = (Object.entries(combined) as [EntityType, number][])
      .sort((a, b) => b[1] - a[1]);

    const topEntity: EntityType = ranked[0]?.[0] ?? 'UNKNOWN';
    const topConfidence         = ranked[0]?.[1] ?? 0;

    const alternatives: AlternativeEntity[] = ranked
      .slice(1, 4)
      .filter(([, c]) => c >= 15)
      .map(([e, c]) => ({ entity: e, confidence: c }));

    return {
      entity:      topEntity,
      confidence:  topConfidence,
      reasons:     allReasons,
      alternatives,
      fieldRoles:  colResult.fieldRoles,
    };
  }
}
