import type { Certificate } from '@/types/security';

const USAGE_LABELS: Record<string, string> = {
  tls: 'TLS',
  mtls_client: 'mTLS',
  code_signing: 'Code Signing',
  saml_signing: 'SAML',
  agent_identity: 'Agent',
};

export function CertCard({ cert, onRenew }: { cert: Certificate; onRenew?: (id: string) => void }) {
  const expiry = new Date(cert.expiresAt).toLocaleDateString();
  const urgent = cert.daysUntilExpiry <= 30;
  const warning = cert.daysUntilExpiry <= 90;

  return (
    <div
      className={`rounded-lg border p-4 ${urgent ? 'border-red-300 dark:border-red-700' : warning ? 'border-amber-300 dark:border-amber-700' : 'border-zinc-200 dark:border-zinc-700'} bg-white dark:bg-zinc-900`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{cert.name}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{cert.subject}</div>
        </div>
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
          {USAGE_LABELS[cert.usage] ?? cert.usage}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <span
            className={`text-sm font-semibold ${urgent ? 'text-red-600' : warning ? 'text-amber-600' : 'text-green-600'}`}
          >
            {cert.daysUntilExpiry}d
          </span>
          <span className="text-xs text-zinc-400 ml-1">until {expiry}</span>
        </div>
        {onRenew && (
          <button
            onClick={() => onRenew(cert.id)}
            className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Renew
          </button>
        )}
      </div>
    </div>
  );
}
