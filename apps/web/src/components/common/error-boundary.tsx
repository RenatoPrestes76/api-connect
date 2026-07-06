'use client';
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children:  React.ReactNode;
  fallback?: React.ReactNode;
}

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-rose-100 bg-rose-50 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-400" />
          <div>
            <p className="font-medium text-rose-700">Something went wrong</p>
            <p className="mt-1 text-sm text-rose-500">{this.state.message}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ hasError: false, message: '' })}
          >
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ErrorStateProps {
  message?:  string;
  onRetry?:  () => void;
  className?: string;
}

export function ErrorState({
  message = 'Failed to load data', onRetry, className,
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center gap-2 py-10 text-center ${className ?? ''}`}>
      <AlertTriangle className="h-6 w-6 text-rose-400" />
      <p className="text-sm text-rose-600">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
      )}
    </div>
  );
}
