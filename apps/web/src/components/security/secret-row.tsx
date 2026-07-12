import type { SecretMetadata } from '@/types/security';

const PROVIDER_LABELS: Record<string, string> = {
  internal: 'Internal',
  hashicorp_vault: 'Vault',
  aws_secrets_manager: 'AWS',
  azure_key_vault: 'Azure',
  gcp_secret_manager: 'GCP',
};

export function SecretRow({ secret }: { secret: SecretMetadata }) {
  const rotated = new Date(secret.rotatedAt).toLocaleDateString();
  const expiring = secret.expiresAt ? new Date(secret.expiresAt) : null;
  const daysLeft = expiring ? Math.ceil((expiring.getTime() - Date.now()) / 86400000) : null;

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <td className="py-3 pr-4">
        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{secret.name}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{secret.description}</div>
      </td>
      <td className="py-3 pr-4">
        <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
          {secret.masked}
        </span>
      </td>
      <td className="py-3 pr-4 text-xs text-zinc-600 dark:text-zinc-400">
        {PROVIDER_LABELS[secret.provider] ?? secret.provider}
      </td>
      <td className="py-3 pr-4 text-xs text-zinc-500">
        v{secret.version} · {rotated}
      </td>
      <td className="py-3 text-xs">
        {daysLeft !== null ? (
          <span className={daysLeft <= 30 ? 'text-amber-600 font-medium' : 'text-zinc-500'}>
            {daysLeft}d
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
    </tr>
  );
}
