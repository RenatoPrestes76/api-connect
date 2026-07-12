'use client';

import { useState } from 'react';
import {
  useGovernancePolicies,
  useSecurityPolicies,
  useSecurityAudit,
  useMarketplace,
} from '@/hooks/use-helios';
import { EventGovernance } from '@/components/helios/EventGovernance';
import { EventSecurity } from '@/components/helios/EventSecurity';
import { EventMarketplace } from '@/components/helios/EventMarketplace';

export default function HeliosGovernancePage() {
  const [tab, setTab] = useState<'governance' | 'security' | 'marketplace'>('governance');
  const [classification, setClassification] = useState('');
  const [criticality, setCriticality] = useState('');
  const [category, setCategory] = useState('');

  const governance = useGovernancePolicies({
    classification: classification || undefined,
    criticality: criticality || undefined,
  });
  const policies = useSecurityPolicies();
  const audit = useSecurityAudit();
  const marketplace = useMarketplace({ category: category || undefined });

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Event Governance & Security
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Ownership · Compliance · Digital signatures · Access control · Event Marketplace
        </p>
      </div>

      <div className="flex gap-1 border-b border-zinc-800">
        {[
          ['governance', 'Governance'],
          ['security', 'Security'],
          ['marketplace', 'Marketplace'],
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

      {tab === 'governance' && (
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
          </div>
          {governance.data && <EventGovernance policies={governance.data.policies} />}
        </>
      )}

      {tab === 'security' && policies.data && audit.data && (
        <EventSecurity policies={policies.data.policies} audit={audit.data.entries} />
      )}

      {tab === 'marketplace' && (
        <>
          <div className="flex items-center gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All categories</option>
              {['commerce', 'fiscal', 'logistics', 'finance', 'crm', 'catalog', 'security'].map(
                (v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                )
              )}
            </select>
            {marketplace.data && (
              <span className="text-xs text-zinc-500">{marketplace.data.total} events</span>
            )}
          </div>
          {marketplace.data && <EventMarketplace events={marketplace.data.events} />}
        </>
      )}
    </div>
  );
}
