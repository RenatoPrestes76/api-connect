import type { ReactElement, ReactNode } from 'react';

export default function LoginLayout({ children }: { children: ReactNode }): ReactElement {
  return <div className="min-h-screen bg-background">{children}</div>;
}
