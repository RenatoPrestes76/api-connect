import { describe, it, expect, beforeEach } from 'vitest';
import { cblEntityTerm, cblFieldTerm } from '../../business-language/index.js';
import { cbmBuilder } from '../builder.js';
import { InMemoryCBMStore } from '../store.js';
import { InMemoryCBMSnapshotStore, computeCBMChecksum } from '../snapshot-store.js';
import type { CBMEntity, CanonicalBusinessModel } from '../index.js';

function buildProductEntity(overrides: Partial<CBMEntity> = {}): Omit<CBMEntity, 'id'> {
  return {
    cblTerm: cblEntityTerm('PRODUCT'),
    entityKind: 'PRODUCT',
    domain: 'catalog',
    sourceName: 'produtos',
    fields: [
      {
        id: 'f1',
        cblTerm: cblFieldTerm('NAME'),
        fieldKind: 'NAME',
        sourceName: 'descricao',
        nullable: false,
        confidence: 90,
        mappingStatus: 'confirmed',
      },
    ],
    primaryKeyFields: ['id'],
    confidence: 90,
    mappingStatus: 'confirmed',
    ...overrides,
  };
}

describe('CBMBuilder', () => {
  it('assembles a CanonicalBusinessModel with computed statistics', () => {
    const session = cbmBuilder.begin('org-1').setDomain('catalog');
    session.addEntity(buildProductEntity());
    session.addEntity(
      buildProductEntity({
        sourceName: 'estoque',
        cblTerm: cblEntityTerm('INVENTORY'),
        entityKind: 'INVENTORY',
        mappingStatus: 'pending-validation',
        confidence: 40,
        fields: [],
      })
    );
    const result = session.build();

    expect(result.success).toBe(true);
    const model = result.data as CanonicalBusinessModel;
    expect(model.entities).toHaveLength(2);
    expect(model.statistics.totalEntities).toBe(2);
    expect(model.statistics.mappedEntities).toBe(1);
    expect(model.statistics.unmappedEntities).toBe(1);
    expect(model.statistics.pendingValidationCount).toBe(1);
    expect(model.version).toBe('1.0.0');
    expect(model.entities[0]?.id).toBeTruthy();
  });

  it('produces distinct ids per entity added in the same session', () => {
    const session = cbmBuilder.begin('org-1');
    session.addEntity(buildProductEntity());
    session.addEntity(buildProductEntity({ sourceName: 'produtos_2' }));
    const result = session.build();
    const ids = new Set((result.data as CanonicalBusinessModel).entities.map((e) => e.id));
    expect(ids.size).toBe(2);
  });
});

describe('InMemoryCBMStore', () => {
  let store: InMemoryCBMStore;

  beforeEach(() => {
    store = new InMemoryCBMStore();
  });

  function build(name: string): CanonicalBusinessModel {
    const result = cbmBuilder
      .begin(name)
      .setDomain('catalog')
      .addEntity(buildProductEntity())
      .build();
    return result.data as CanonicalBusinessModel;
  }

  it('saves and retrieves a model by id', async () => {
    const model = build('org-1');
    const saved = await store.save(model);
    expect(saved.success).toBe(true);

    const fetched = await store.get(model.id);
    expect(fetched.success).toBe(true);
    expect(fetched.data?.id).toBe(model.id);
  });

  it('returns an error for an unknown model id', async () => {
    const result = await store.get('does-not-exist');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('REGISTRY_ERROR');
  });

  it('getLatest returns the most recently saved version for a name', async () => {
    const v1 = build('org-1');
    await store.save(v1);
    const v2 = { ...build('org-1'), version: '1.0.1' };
    await store.save(v2);

    const latest = await store.getLatest('org-1');
    expect(latest.data?.id).toBe(v2.id);
  });

  it('getLatest returns null when nothing has been saved for a name', async () => {
    const result = await store.getLatest('unknown-org');
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('keeps every version in append-only history — nothing overwritten', async () => {
    const v1 = build('org-1');
    await store.save(v1);
    const v2 = build('org-1');
    await store.save(v2);

    const history = await store.listHistory('org-1');
    expect(history.map((m) => m.id)).toEqual([v1.id, v2.id]);
    // Both versions remain independently fetchable — this is what rollback relies on.
    expect((await store.get(v1.id)).data?.id).toBe(v1.id);
    expect((await store.get(v2.id)).data?.id).toBe(v2.id);
  });

  it('list supports domain/confidence filtering and pagination', async () => {
    await store.save(build('org-1'));
    await store.save({ ...build('org-2'), domain: 'finance', confidence: 10 });

    const catalogOnly = await store.list({ domain: 'catalog' });
    expect(catalogOnly.data).toHaveLength(1);

    const highConfidence = await store.list({ minConfidence: 50 });
    expect(highConfidence.data).toHaveLength(1);
  });

  it('deletes a model', async () => {
    const model = build('org-1');
    await store.save(model);
    const deleted = await store.delete(model.id);
    expect(deleted.success).toBe(true);
    expect(await store.exists(model.id)).toBe(false);
  });
});

describe('InMemoryCBMSnapshotStore', () => {
  it('computes a stable checksum regardless of entity/field ordering', () => {
    const modelA = cbmBuilder
      .begin('org-1')
      .addEntity(buildProductEntity({ sourceName: 'a' }))
      .addEntity(buildProductEntity({ sourceName: 'b' }))
      .build().data as CanonicalBusinessModel;
    const modelB = cbmBuilder
      .begin('org-1')
      .addEntity(buildProductEntity({ sourceName: 'b' }))
      .addEntity(buildProductEntity({ sourceName: 'a' }))
      .build().data as CanonicalBusinessModel;

    expect(computeCBMChecksum(modelA)).toBe(computeCBMChecksum(modelB));
  });

  it('diff reports no changes between identical model content', () => {
    const snapshotStore = new InMemoryCBMSnapshotStore();
    const model = cbmBuilder.begin('org-1').addEntity(buildProductEntity()).build()
      .data as CanonicalBusinessModel;
    const snapA = snapshotStore.take(model).data!;
    const snapB = snapshotStore.take(model).data!;

    const diff = snapshotStore.diff(snapA, snapB);
    expect(diff.hasChanges).toBe(false);
  });

  it('diff detects added, removed, and remapped entities/fields', () => {
    const snapshotStore = new InMemoryCBMSnapshotStore();
    const before = cbmBuilder
      .begin('org-1')
      .addEntity(buildProductEntity({ sourceName: 'produtos' }))
      .addEntity(buildProductEntity({ sourceName: 'compras' }))
      .build().data as CanonicalBusinessModel;

    const after = cbmBuilder
      .begin('org-1')
      .addEntity(
        buildProductEntity({ sourceName: 'produtos', cblTerm: cblEntityTerm('INVENTORY') })
      )
      .addEntity(buildProductEntity({ sourceName: 'clientes' }))
      .build().data as CanonicalBusinessModel;

    const snapBefore = snapshotStore.take(before).data!;
    const snapAfter = snapshotStore.take(after).data!;
    const diff = snapshotStore.diff(snapBefore, snapAfter);

    expect(diff.hasChanges).toBe(true);
    expect(diff.addedEntities.map((e) => e.sourceName)).toEqual(['clientes']);
    expect(diff.removedEntities.map((e) => e.sourceName)).toEqual(['compras']);
    expect(diff.remappedEntities).toEqual([
      { entity: 'produtos', from: cblEntityTerm('PRODUCT'), to: cblEntityTerm('INVENTORY') },
    ]);
  });

  it('listForModel returns every snapshot taken for a model id', async () => {
    const snapshotStore = new InMemoryCBMSnapshotStore();
    const model = cbmBuilder.begin('org-1').addEntity(buildProductEntity()).build()
      .data as CanonicalBusinessModel;
    snapshotStore.take(model);
    snapshotStore.take(model);

    const list = await snapshotStore.listForModel(model.id);
    expect(list.data).toHaveLength(2);
  });
});
