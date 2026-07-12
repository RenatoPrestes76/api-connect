'use client';

import { useState } from 'react';
import { useCatalog, useSchemas, useRollbackSchema } from '@/hooks/use-helios';
import { EventCatalogList } from '@/components/helios/EventCatalogList';
import { SchemaRegistry } from '@/components/helios/SchemaRegistry';

export default function HeliosCatalogPage() {
  const [tab, setTab] = useState<'catalog' | 'schema'>('catalog');
  const [classification, setClassification] = useState('');
  const [criticality, setCriticality] = useState('');
  const [schemaStatus, setSchemaStatus] = useState('');

  const catalog = useCatalog({
    classification: classification || undefined,
    criticality: criticality || undefined,
  });
  const schemas = useSchemas(schemaStatus || undefined);
  const rollback = useRollbackSchema();

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Event Catalog & Schema Registry
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Automated documentation · Schema versioning · Backward compatibility
        </p>
      </div>

      <div className="flex gap-1 border-b border-zinc-800">
        {[
          ['catalog', 'Event Catalog'],
          ['schema', 'Schema Registry'],
        ].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === v ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All classifications</option>
              {['public', 'internal', 'confidential', 'restricted'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select
              value={criticality}
              onChange={(e) => setCriticality(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All criticalities</option>
              {['low', 'medium', 'high', 'critical'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            {catalog.data && (
              <span className="text-xs text-zinc-500">{catalog.data.total} entries</span>
            )}
          </div>
          {catalog.data && <EventCatalogList entries={catalog.data.entries} />}
        </>
      )}

      {tab === 'schema' && (
        <>
          <div className="flex items-center gap-3">
            <select
              value={schemaStatus}
              onChange={(e) => setSchemaStatus(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All statuses</option>
              {['active', 'deprecated', 'draft'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            {schemas.data && (
              <span className="text-xs text-zinc-500">{schemas.data.total} versions</span>
            )}
          </div>
          {schemas.data && (
            <SchemaRegistry
              schemas={schemas.data.schemas}
              onRollback={(eventType, version) => rollback.mutate({ eventType, version })}
            />
          )}
        </>
      )}
    </div>
  );
}
