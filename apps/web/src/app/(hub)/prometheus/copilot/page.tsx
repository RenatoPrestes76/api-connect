'use client';

import {
  useCapacityPlan,
  useCostReport,
  useRunbooks,
  useExecuteRunbook,
  useQueryCopilot,
} from '@/hooks/use-prometheus';
import { ExecutiveCopilot } from '@/components/prometheus/ExecutiveCopilot';
import { CapacityPlanning } from '@/components/prometheus/CapacityPlanning';
import { CostIntelligence } from '@/components/prometheus/CostIntelligence';
import { RunbookEngine } from '@/components/prometheus/RunbookEngine';
import { prometheusService } from '@/services/prometheus.service';

export default function PrometheusAIOpsPage() {
  const capacity = useCapacityPlan();
  const costs = useCostReport();
  const runbooks = useRunbooks();
  const execRunbook = useExecuteRunbook();
  const copilot = useQueryCopilot();

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">AIOps Center</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Capacity planning, cost intelligence, runbooks & executive copilot
        </p>
      </div>

      {/* Copilot (full width) */}
      <ExecutiveCopilot onQuery={prometheusService.queryCopilot} />

      {/* Capacity + Costs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {capacity.data && <CapacityPlanning plan={capacity.data} />}
        {costs.data && <CostIntelligence report={costs.data} />}
      </div>

      {/* Runbooks */}
      <RunbookEngine
        runbooks={runbooks.data?.runbooks ?? []}
        onExecute={(id) => execRunbook.mutate(id)}
        isPending={execRunbook.isPending}
      />
    </div>
  );
}
