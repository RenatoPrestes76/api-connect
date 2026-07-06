/**
 * SamplingScorer — detects patterns in sampled column values.
 *
 * Looks for:
 *  - EAN/GTIN patterns (13-digit, 8-digit numerics)
 *  - Price-like patterns (numeric with decimal)
 *  - CPF/CNPJ patterns → CUSTOMER or BRANCH signals
 *  - UUID columns → IDENTIFIER signal
 *  - ISO date strings
 */
import { EAN_VALUE_PATTERNS, PRICE_VALUE_PATTERN } from '../knowledge/field-patterns.js';
import type { EntityType, FieldRole, ScoreMap, ScoringReason } from '../types/index.js';

export interface SampledColumn {
  readonly name:         string;
  readonly sampleValues: readonly string[];
}

export interface SamplingScoreResult {
  readonly scores:      ScoreMap;
  readonly reasons:     readonly ScoringReason[];
  readonly detectedRoles: Readonly<Record<string, FieldRole>>;
}

const CPF_RE   = /^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const CNPJ_RE  = /^\d{14}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE  = /^\d{4}-\d{2}-\d{2}/;

export class SamplingScorer {
  score(sampledColumns: readonly SampledColumn[]): SamplingScoreResult {
    const scores: ScoreMap = {};
    const reasons: ScoringReason[] = [];
    const detectedRoles: Record<string, FieldRole> = {};

    for (const col of sampledColumns) {
      const values = col.sampleValues.filter(Boolean);
      if (values.length === 0) continue;

      const colLower = col.name.toLowerCase();

      // ─── EAN detection ────────────────────────────────────────────────
      const eanMatches = values.filter((v) => EAN_VALUE_PATTERNS.some((re) => re.test(v.trim())));
      if (eanMatches.length >= Math.ceil(values.length * 0.5)) {
        scores['PRODUCT'] = Math.min(100, (scores['PRODUCT'] ?? 0) + 80);
        detectedRoles[col.name] = 'EAN';
        reasons.push({
          signal: 'sample_ean',
          weight: 80,
          detail: `column "${col.name}" has ${eanMatches.length}/${values.length} EAN-like values`,
        });
        continue;
      }

      // ─── Price detection ──────────────────────────────────────────────
      const priceMatches = values.filter((v) => PRICE_VALUE_PATTERN.test(v.replace(',', '.')));
      if (priceMatches.length >= Math.ceil(values.length * 0.7) &&
          (colLower.includes('preco') || colLower.includes('price') || colLower.includes('vl_') || colLower.includes('valor'))) {
        scores['PRICE'] = Math.min(100, (scores['PRICE'] ?? 0) + 40);
        scores['PRODUCT'] = Math.min(100, (scores['PRODUCT'] ?? 0) + 20);
        detectedRoles[col.name] = 'PRICE';
        reasons.push({
          signal: 'sample_price',
          weight: 40,
          detail: `column "${col.name}" has price-like numeric values`,
        });
        continue;
      }

      // ─── CPF detection → CUSTOMER ─────────────────────────────────────
      const cpfMatches = values.filter((v) => CPF_RE.test(v.trim()));
      if (cpfMatches.length >= Math.ceil(values.length * 0.5)) {
        scores['CUSTOMER'] = Math.min(100, (scores['CUSTOMER'] ?? 0) + 70);
        detectedRoles[col.name] = 'IDENTIFIER';
        reasons.push({
          signal: 'sample_cpf',
          weight: 70,
          detail: `column "${col.name}" contains CPF-like values — suggests CUSTOMER`,
        });
        continue;
      }

      // ─── CNPJ detection → BRANCH or SUPPLIER ─────────────────────────
      const cnpjMatches = values.filter((v) => CNPJ_RE.test(v.trim()));
      if (cnpjMatches.length >= Math.ceil(values.length * 0.5)) {
        scores['BRANCH']   = Math.min(100, (scores['BRANCH']   ?? 0) + 50);
        scores['SUPPLIER'] = Math.min(100, (scores['SUPPLIER'] ?? 0) + 50);
        detectedRoles[col.name] = 'IDENTIFIER';
        reasons.push({
          signal: 'sample_cnpj',
          weight: 50,
          detail: `column "${col.name}" contains CNPJ-like values — suggests BRANCH or SUPPLIER`,
        });
        continue;
      }

      // ─── UUID detection → IDENTIFIER (reduces LOOKUP confidence) ─────
      const uuidMatches = values.filter((v) => UUID_RE.test(v.trim()));
      if (uuidMatches.length >= Math.ceil(values.length * 0.8)) {
        detectedRoles[col.name] = 'IDENTIFIER';
        scores['LOOKUP'] = Math.max(0, (scores['LOOKUP'] ?? 0) - 20);
        reasons.push({
          signal: 'sample_uuid',
          weight: -20,
          detail: `column "${col.name}" uses UUIDs as identifiers — reduces LOOKUP confidence`,
        });
      }
    }

    return { scores, reasons, detectedRoles };
  }
}
