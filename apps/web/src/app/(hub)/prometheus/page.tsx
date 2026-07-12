'use client';

import { useState } from 'react';
import {
  useTelemetryOverview,
  useServiceMap,
  useAnomalies,
  usePredictiveAlerts,
  useRecommendations,
  useSLOTargets,
  useSelfHealingRules,
  useApplyRecommendation,
  useDismissRecommendation,
  useToggleSelfHealingRule,
} from '@/hooks/use-prometheus';
import { TelemetryOverview } from '@/components/prometheus/TelemetryOverview';
import { ServiceMap } from '@/components/prometheus/ServiceMap';
import { AnomalyDetector } from '@/components/prometheus/AnomalyDetector';
import { PredictiveAlerts } from '@/components/prometheus/PredictiveAlerts';
import { AIRecommendations } from '@/components/prometheus/AIRecommendations';
import { SLODashboard } from '@/components/prometheus/SLODashboard';
import { SelfHealingPanel } from '@/components/prometheus/SelfHealingPanel';

export default function PrometheusPage() {
  const [toast, setToast] = useState<string | null>(null);

  const telemetry = useTelemetryOverview();
  const serviceMap = useServiceMap();
  const anomalies = useAnomalies();
  const alerts = usePredictiveAlerts();
  const recs = useRecommendations();
  const slo = useSLOTargets();
  const healing = useSelfHealingRules();

  const applyRec = useApplyRecommendation();
  const dismissRec = useDismissRecommendation();
  const toggleHeal = useToggleSelfHealingRule();

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4_000);
  }

  if (telemetry.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-400">Loading PROMETHEUS…</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">PROMETHEUS</h1>
          <p className="text-sm text-zinc-400 mt-1">
            AI Observability & Autonomous Operations — Sprint 44
          </p>
        </div>
        {toast && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-md px-3 py-1.5">
            {toast}
          </span>
        )}
      </div>

      {telemetry.data && <TelemetryOverview data={telemetry.data} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {serviceMap.data && <ServiceMap map={serviceMap.data} />}
        <AnomalyDetector anomalies={anomalies.data?.anomalies ?? []} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PredictiveAlerts alerts={alerts.data?.alerts ?? []} />
        <AIRecommendations
          recommendations={recs.data?.recommendations ?? []}
          onApply={(id) => applyRec.mutate(id, { onSuccess: (r) => notify(`Applied: ${r.title}`) })}
          onDismiss={(id) =>
            dismissRec.mutate(id, { onSuccess: (r) => notify(`Dismissed: ${r.title}`) })
          }
          isPending={applyRec.isPending || dismissRec.isPending}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SLODashboard targets={slo.data?.targets ?? []} />
        <SelfHealingPanel
          rules={healing.data?.rules ?? []}
          enabled={healing.data?.enabled ?? 0}
          onToggle={(id) =>
            toggleHeal.mutate(id, {
              onSuccess: (r) => notify(`${r.name}: ${r.enabled ? 'enabled' : 'disabled'}`),
            })
          }
          isPending={toggleHeal.isPending}
        />
      </div>
    </div>
  );
}
