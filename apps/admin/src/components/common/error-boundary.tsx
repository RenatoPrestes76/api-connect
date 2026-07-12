'use client';
import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-danger/20 bg-danger/5 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-danger" />
          <div>
            <p className="font-medium text-danger">Algo deu errado</p>
            <p className="mt-1 text-sm text-danger/80">{this.state.message}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ hasError: false, message: '' })}
          >
            Tentar novamente
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message = 'Falha ao carregar os dados',
  onRetry,
  className,
}: ErrorStateProps): React.ReactElement {
  return (
    <div className={`flex flex-col items-center gap-2 py-10 text-center ${className ?? ''}`}>
      <AlertTriangle className="h-6 w-6 text-danger" />
      <p className="text-sm text-danger">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
