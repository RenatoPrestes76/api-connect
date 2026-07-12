'use client';

import { useSsoProviders, useMfaStatus } from '@/hooks/use-security';

const PROTOCOL_COLORS: Record<string, string> = {
  oidc: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  saml2: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  oauth2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const SLUG_ICONS: Record<string, string> = {
  microsoft_entra: '🪟',
  google_workspace: '🔵',
  okta: '🔐',
  ping_identity: '🏓',
  generic_oidc: '🔑',
  saml_generic: '📋',
};

export default function SsoPage() {
  const { data: ssoData, isLoading: ssoLoading } = useSsoProviders();
  const { data: mfaData } = useMfaStatus();

  const providers = (ssoData as any)?.providers ?? [];
  const mfa = mfaData as any;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">SSO & MFA</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Enterprise single sign-on providers and multi-factor authentication status.
        </p>
      </div>

      {/* MFA status */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Multi-Factor Authentication
        </h2>
        {mfa ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-zinc-500">Status</div>
              <div
                className={`mt-1 font-semibold ${mfa.enrolled ? 'text-green-600' : 'text-zinc-500'}`}
              >
                {mfa.enrolled ? '✓ Enrolled' : 'Not enrolled'}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Backup Codes</div>
              <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
                {mfa.backupCodesRemaining ?? 0} remaining
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Trusted Devices</div>
              <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
                {mfa.trustedDevices?.length ?? 0}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Last Used</div>
              <div className="mt-1 text-zinc-600 dark:text-zinc-400">
                {mfa.lastUsedAt ? new Date(mfa.lastUsedAt).toLocaleDateString() : '—'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-400">Loading MFA status…</div>
        )}
      </div>

      {/* SSO providers */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            SSO Providers ({providers.length})
          </h2>
        </div>
        {ssoLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {providers.map((p: any) => (
              <div key={p.id} className="px-4 py-4 flex items-center gap-4">
                <span className="text-2xl">{SLUG_ICONS[p.slug] ?? '🔑'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                      {p.name}
                    </span>
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded ${PROTOCOL_COLORS[p.protocol] ?? 'bg-zinc-100 text-zinc-600'}`}
                    >
                      {p.protocol.toUpperCase()}
                    </span>
                    <span className={`text-xs ${p.active ? 'text-green-600' : 'text-zinc-400'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5 truncate">{p.issuer}</div>
                </div>
                <div className="text-xs text-zinc-400 shrink-0">
                  {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
