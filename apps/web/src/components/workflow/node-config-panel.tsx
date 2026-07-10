'use client';
import type { WorkflowNode } from '@/types/workflow';

interface NodeConfigPanelProps {
  node: WorkflowNode | null;
  onChange: (node: WorkflowNode) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, onChange, onClose }: NodeConfigPanelProps) {
  if (!node) return null;

  const update = (key: string, value: unknown) => {
    onChange({ ...node, config: { ...node.config, [key]: value } });
  };

  return (
    <aside className="w-64 shrink-0 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-y-auto flex flex-col">
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-slate-700">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Configure</p>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-0.5">
            {node.label}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Label */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
          <input
            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={node.label}
            onChange={(e) => onChange({ ...node, label: e.target.value })}
          />
        </div>

        {/* Type-specific fields */}
        {renderConfigFields(node, update)}
      </div>
    </aside>
  );
}

function renderConfigFields(node: WorkflowNode, update: (key: string, value: unknown) => void) {
  const cfg = node.config as Record<string, unknown>;

  switch (node.type) {
    case 'trigger':
      return (
        <>
          <Field label="Trigger Type">
            <select
              className="config-select"
              value={String(cfg['triggerType'] ?? 'MANUAL')}
              onChange={(e) => update('triggerType', e.target.value)}
            >
              {['WEBHOOK', 'CRON', 'EVENT', 'MANUAL'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          {cfg['triggerType'] === 'CRON' && (
            <Field label="Cron Expression">
              <input
                className="config-input"
                placeholder="0 8 * * *"
                value={String(cfg['cronExpr'] ?? '')}
                onChange={(e) => update('cronExpr', e.target.value)}
              />
            </Field>
          )}
          {cfg['triggerType'] === 'EVENT' && (
            <Field label="Event Type">
              <input
                className="config-input"
                placeholder="product.updated"
                value={String(cfg['eventType'] ?? '')}
                onChange={(e) => update('eventType', e.target.value)}
              />
            </Field>
          )}
        </>
      );

    case 'http':
      return (
        <>
          <Field label="Method">
            <select
              className="config-select"
              value={String(cfg['method'] ?? 'GET')}
              onChange={(e) => update('method', e.target.value)}
            >
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="URL">
            <input
              className="config-input"
              placeholder="https://api.example.com/endpoint"
              value={String(cfg['url'] ?? '')}
              onChange={(e) => update('url', e.target.value)}
            />
          </Field>
          <Field label="Timeout (ms)">
            <input
              className="config-input"
              type="number"
              placeholder="15000"
              value={String(cfg['timeout'] ?? '')}
              onChange={(e) => update('timeout', Number(e.target.value))}
            />
          </Field>
        </>
      );

    case 'condition':
      return (
        <Field label="Expression">
          <textarea
            className="config-textarea"
            rows={3}
            placeholder="context.http.status < 300"
            value={String(cfg['expression'] ?? '')}
            onChange={(e) => update('expression', e.target.value)}
          />
          <p className="text-[10px] text-slate-400 mt-1">Left edge = true, right edge = false</p>
        </Field>
      );

    case 'transform':
      return (
        <>
          <Field label="Expression">
            <textarea
              className="config-textarea"
              rows={3}
              placeholder="map(input, 'erp-product-schema')"
              value={String(cfg['expression'] ?? '')}
              onChange={(e) => update('expression', e.target.value)}
            />
          </Field>
          <Field label="Output Variable">
            <input
              className="config-input"
              placeholder="product"
              value={String(cfg['outputVar'] ?? '')}
              onChange={(e) => update('outputVar', e.target.value)}
            />
          </Field>
        </>
      );

    case 'validate':
      return (
        <>
          <Field label="Schema">
            <input
              className="config-input"
              placeholder="product"
              value={String(cfg['schema'] ?? '')}
              onChange={(e) => update('schema', e.target.value)}
            />
          </Field>
          <Field label="Fail on Error">
            <input
              type="checkbox"
              checked={Boolean(cfg['failOnError'])}
              onChange={(e) => update('failOnError', e.target.checked)}
            />
          </Field>
        </>
      );

    case 'retry':
      return (
        <>
          <Field label="Max Attempts">
            <input
              className="config-input"
              type="number"
              min={1}
              max={10}
              value={String(cfg['maxAttempts'] ?? '3')}
              onChange={(e) => update('maxAttempts', Number(e.target.value))}
            />
          </Field>
          <Field label="Backoff (ms)">
            <input
              className="config-input"
              type="number"
              value={String(cfg['backoffMs'] ?? '2000')}
              onChange={(e) => update('backoffMs', Number(e.target.value))}
            />
          </Field>
          <Field label="Strategy">
            <select
              className="config-select"
              value={String(cfg['strategy'] ?? 'exponential')}
              onChange={(e) => update('strategy', e.target.value)}
            >
              {['fixed', 'linear', 'exponential'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </>
      );

    case 'delay':
      return (
        <Field label="Duration (ms)">
          <input
            className="config-input"
            type="number"
            value={String(cfg['durationMs'] ?? '5000')}
            onChange={(e) => update('durationMs', Number(e.target.value))}
          />
        </Field>
      );

    case 'notification':
      return (
        <>
          <Field label="Channel">
            <select
              className="config-select"
              value={String(cfg['channel'] ?? 'email')}
              onChange={(e) => update('channel', e.target.value)}
            >
              {['email', 'webhook', 'slack'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="To">
            <input
              className="config-input"
              placeholder="ops@example.com"
              value={String(cfg['to'] ?? '')}
              onChange={(e) => update('to', e.target.value)}
            />
          </Field>
          <Field label="Subject">
            <input
              className="config-input"
              placeholder="Alert: Sync Failed"
              value={String(cfg['subject'] ?? '')}
              onChange={(e) => update('subject', e.target.value)}
            />
          </Field>
        </>
      );

    case 'log':
      return (
        <>
          <Field label="Level">
            <select
              className="config-select"
              value={String(cfg['level'] ?? 'info')}
              onChange={(e) => update('level', e.target.value)}
            >
              {['debug', 'info', 'warn', 'error'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Message">
            <input
              className="config-input"
              placeholder="Sync completed: {{product.id}}"
              value={String(cfg['message'] ?? '')}
              onChange={(e) => update('message', e.target.value)}
            />
          </Field>
        </>
      );

    case 'dlq':
      return (
        <Field label="Reason">
          <input
            className="config-input"
            placeholder="Missing required field"
            value={String(cfg['reason'] ?? '')}
            onChange={(e) => update('reason', e.target.value)}
          />
        </Field>
      );

    default:
      return null;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
