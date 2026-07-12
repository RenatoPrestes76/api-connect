'use client';
import { useState, type FormEvent, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { changePassword, AdminAuthError } from '@/services/auth.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ChangePasswordPage(): ReactElement {
  const router = useRouter();
  const { user, refresh } = useAdminAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      await refresh();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof AdminAuthError ? err.message : 'Falha ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent shadow">
            <KeyRound className="h-5 w-5 text-accent-foreground" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Troca de senha obrigatória</h1>
          <p className="max-w-xs text-center text-sm text-muted-foreground">
            {user ? `Olá, ${user.name}. ` : ''}
            Por segurança, defina uma nova senha antes de continuar.
          </p>
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
            <label className="block text-sm font-medium text-foreground" htmlFor="currentPassword">
              Senha atual
            </label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground" htmlFor="newPassword">
              Nova senha
            </label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground" htmlFor="confirmPassword">
              Confirmar nova senha
            </label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" loading={loading} className="w-full">
            Alterar senha
          </Button>
        </form>
      </div>
    </div>
  );
}
