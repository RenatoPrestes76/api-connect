'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { AdminAuthError } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos.',
  ACCOUNT_LOCKED: 'Conta bloqueada por excesso de tentativas. Tente novamente em 15 minutos.',
  ACCOUNT_DISABLED: 'Esta conta foi desativada.',
  ACCOUNT_SUSPENDED: 'Esta conta está suspensa.',
  MISSING_FIELDS: 'Informe e-mail e senha.',
};

export default function LoginPage(): ReactElement {
  const router = useRouter();
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { mustChangePassword } = await login(email, password);
      router.push(mustChangePassword ? '/change-password' : '/dashboard');
    } catch (err) {
      if (err instanceof AdminAuthError) {
        setError(ERROR_MESSAGES[err.code] ?? err.message);
      } else {
        setError('Falha ao entrar');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent shadow">
            <Shield className="h-5 w-5 text-accent-foreground" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Atlas Control Plane</h1>
          <p className="text-sm text-muted-foreground">Acesso administrativo global</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="admin@atlasconnect.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground" htmlFor="password">
              Senha
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" loading={loading} className="w-full">
            Entrar
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Seltriva Connect — Atlas Control Plane
        </p>
      </div>
    </div>
  );
}
