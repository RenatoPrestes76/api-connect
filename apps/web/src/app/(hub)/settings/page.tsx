'use client';
import { useState, useEffect, type FormEvent } from 'react';
import { PageHeader } from '@/components/common/page-header';
import { PageLoading } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettings, useUpdateSettings } from '@/hooks/use-settings';
import type { HubSettings } from '@/types/index';

export default function SettingsPage() {
  const { data, isLoading, error } = useSettings();
  const update = useUpdateSettings();
  const [form, setForm] = useState<HubSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading) return <PageLoading />;
  if (error)     return <ErrorState message="Could not load settings." />;
  if (!form)     return null;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    await update.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const setSync   = (key: keyof HubSettings['sync'],  value: number | boolean) =>
    setForm((f) => f ? { ...f, sync:   { ...f.sync,  [key]: value } } : f);
  const setCache  = (key: keyof HubSettings['cache'], value: number) =>
    setForm((f) => f ? { ...f, cache:  { ...f.cache, [key]: value } } : f);
  const setDisc   = (key: keyof HubSettings['discovery'], value: number | boolean) =>
    setForm((f) => f ? { ...f, discovery: { ...f.discovery, [key]: value } } : f);
  const setNotif  = (key: keyof HubSettings['notifications'], value: string | boolean) =>
    setForm((f) => f ? { ...f, notifications: { ...f.notifications, [key]: value } } : f);

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader title="Settings" description="Global configuration for Atlas Hub." />

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        {/* Sync */}
        <Card>
          <CardHeader><CardTitle>Sync</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FieldRow label="Interval (ms)">
              <Input type="number" value={form.sync.intervalMs}
                onChange={(e) => setSync('intervalMs', Number(e.target.value))} />
            </FieldRow>
            <FieldRow label="Retry Attempts">
              <Input type="number" value={form.sync.retryAttempts}
                onChange={(e) => setSync('retryAttempts', Number(e.target.value))} />
            </FieldRow>
            <FieldRow label="Timeout (ms)">
              <Input type="number" value={form.sync.timeoutMs}
                onChange={(e) => setSync('timeoutMs', Number(e.target.value))} />
            </FieldRow>
            <FieldRow label="Batch Size">
              <Input type="number" value={form.sync.batchSize}
                onChange={(e) => setSync('batchSize', Number(e.target.value))} />
            </FieldRow>
            <FieldRow label="Incremental Sync">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.sync.enableIncremental}
                  onChange={(e) => setSync('enableIncremental', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">Enabled</span>
              </label>
            </FieldRow>
          </CardContent>
        </Card>

        {/* Cache */}
        <Card>
          <CardHeader><CardTitle>Cache</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FieldRow label="TTL (ms)">
              <Input type="number" value={form.cache.ttlMs}
                onChange={(e) => setCache('ttlMs', Number(e.target.value))} />
            </FieldRow>
            <FieldRow label="Max Entries">
              <Input type="number" value={form.cache.maxEntries}
                onChange={(e) => setCache('maxEntries', Number(e.target.value))} />
            </FieldRow>
          </CardContent>
        </Card>

        {/* Discovery */}
        <Card>
          <CardHeader><CardTitle>Discovery</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FieldRow label="Auto-run on Connect">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.discovery.autoRunOnConnect}
                  onChange={(e) => setDisc('autoRunOnConnect', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">Enabled</span>
              </label>
            </FieldRow>
            <FieldRow label="Min Confidence (%)">
              <Input type="number" value={form.discovery.confidenceMinimum}
                onChange={(e) => setDisc('confidenceMinimum', Number(e.target.value))} />
            </FieldRow>
            <FieldRow label="Schema TTL (ms)">
              <Input type="number" value={form.discovery.schemaTtlMs}
                onChange={(e) => setDisc('schemaTtlMs', Number(e.target.value))} />
            </FieldRow>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FieldRow label="Alert Email">
              <Input type="email" value={form.notifications.alertEmail}
                onChange={(e) => setNotif('alertEmail', e.target.value)} />
            </FieldRow>
            <FieldRow label="Email Alerts">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.notifications.enableEmailAlerts}
                  onChange={(e) => setNotif('enableEmailAlerts', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">Enabled</span>
              </label>
            </FieldRow>
            <FieldRow label="Alert on Failure">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.notifications.alertOnFailure}
                  onChange={(e) => setNotif('alertOnFailure', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">Enabled</span>
              </label>
            </FieldRow>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={update.isPending}>
            Save Settings
          </Button>
          {saved && <span className="text-sm text-emerald-600">Saved successfully.</span>}
          {update.error && (
            <span className="text-sm text-rose-600">
              {update.error instanceof Error ? update.error.message : 'Save failed.'}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-600 shrink-0 w-44">{label}</span>
      <div className="flex-1 max-w-xs">{children}</div>
    </div>
  );
}
