import { randomUUID } from 'node:crypto';
import type {
  DatabaseIntelligenceReport,
  EntityClassification,
} from '@seltriva/database-intelligence';
import { cbmBuilder, cblEntityTerm, cblFieldTerm } from '@seltriva/semantic-engine';
import type { CanonicalBusinessModel, CBMField, CBLDomainKind } from '@seltriva/semantic-engine';
import { erpConnectivityStore } from '../erp-connectivity/erp-connectivity-store.js';
import { erpMetadataStore } from '../erp-metadata/erp-metadata-store.js';
import { semanticMappingStore } from '../semantic-mapping/semantic-mapping-store.js';
import {
  BUSINESS_TO_CBL_ENTITY,
  cblDomainForEntity,
  translateFieldRole,
} from './cbl-translation.js';

export type BuildCanonicalModelError = 'NO_APPROVED_MAPPINGS';
export type BuildCanonicalModelResult =
  | {
      ok: true;
      model: CanonicalBusinessModel;
      profilesConsidered: number;
      profilesContributing: number;
    }
  | { ok: false; error: BuildCanonicalModelError };

function findClassification(
  report: DatabaseIntelligenceReport,
  schema: string,
  table: string
): EntityClassification | undefined {
  for (const classifications of Object.values(report.entities)) {
    const found = classifications?.find((c) => c.tableSchema === schema && c.tableName === table);
    if (found) return found;
  }
  return undefined;
}

function buildFields(classification: EntityClassification | undefined): CBMField[] {
  if (!classification) return [];
  const fields: CBMField[] = [];
  for (const [columnName, assignment] of classification.fieldRoles) {
    const cblField = translateFieldRole(assignment.role);
    fields.push({
      id: randomUUID(),
      cblTerm: cblField ? cblFieldTerm(cblField) : cblFieldTerm('METADATA'),
      fieldKind: cblField ?? 'METADATA',
      sourceName: columnName,
      nullable: true,
      confidence: assignment.confidence,
      mappingStatus: cblField ? 'auto-approved' : 'unmapped',
    });
  }
  return fields;
}

function primaryKeyFieldNames(classification: EntityClassification | undefined): string[] {
  if (!classification) return [];
  const names: string[] = [];
  for (const [columnName, assignment] of classification.fieldRoles) {
    if (assignment.role === 'IDENTIFIER') names.push(columnName);
  }
  return names;
}

function majorityDomain(domains: CBLDomainKind[]): CBLDomainKind {
  if (domains.length === 0) return 'system';
  const counts = new Map<CBLDomainKind, number>();
  for (const domain of domains) counts.set(domain, (counts.get(domain) ?? 0) + 1);
  let best: CBLDomainKind = domains[0] as CBLDomainKind;
  let bestCount = 0;
  for (const [domain, count] of counts) {
    if (count > bestCount) {
      best = domain;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Builds one organization-wide CanonicalBusinessModel from every connected
 * ERP's *approved* semantic-mapping records (Sprint 46.10) — never re-reads
 * live ERP data. Multiple ERPs can each contribute tables that resolve to
 * the same CBL entity (e.g. two ERPs' product tables both become PRODUCT);
 * they remain distinct CBMEntity instances tagged back to their own
 * profile/table via sourceName + metadata, matching the spec's flow: label
 * uniformly, don't merge records.
 */
export function buildCanonicalModelForOrganization(
  organizationId: string
): BuildCanonicalModelResult {
  const profiles = erpConnectivityStore.listProfiles({ organizationId });
  const domains: CBLDomainKind[] = [];
  const session = cbmBuilder.begin(organizationId, {
    description: `Canonical Business Model for organization ${organizationId}`,
  });

  let profilesContributing = 0;

  for (const profile of profiles) {
    const report = erpMetadataStore.getReport(profile.id);
    if (!report) continue; // this ERP hasn't been discovered/classified yet — skip, not fatal

    const approved = semanticMappingStore
      .listEntities(profile.id)
      .filter((record) => record.status === 'APPROVED');
    if (approved.length === 0) continue;

    let contributedFromThisProfile = false;
    for (const mapping of approved) {
      const businessEntity = mapping.approvedEntity ?? mapping.suggestedEntity;
      const cblKind = BUSINESS_TO_CBL_ENTITY[businessEntity];
      if (!cblKind) continue; // e.g. NAO_MAPEADO — never enters the canonical model

      const classification = findClassification(report, mapping.schema, mapping.table);
      const domain = cblDomainForEntity(cblKind);
      domains.push(domain);

      session.addEntity({
        cblTerm: cblEntityTerm(cblKind),
        entityKind: cblKind,
        domain,
        sourceName: `${profile.id}:${mapping.schema}.${mapping.table}`,
        sourceEntityId: profile.id,
        fields: buildFields(classification),
        primaryKeyFields: primaryKeyFieldNames(classification),
        confidence: 100, // a human approved this mapping — uncertainty is resolved
        mappingStatus: 'confirmed',
        metadata: {
          profileId: profile.id,
          erpName: profile.erpName,
          schema: mapping.schema,
          table: mapping.table,
        },
      });
      contributedFromThisProfile = true;
    }
    if (contributedFromThisProfile) profilesContributing += 1;
  }

  if (profilesContributing === 0) {
    return { ok: false, error: 'NO_APPROVED_MAPPINGS' };
  }

  session.setDomain(majorityDomain(domains));
  const result = session.build();
  return {
    ok: true,
    model: result.data as CanonicalBusinessModel,
    profilesConsidered: profiles.length,
    profilesContributing,
  };
}
