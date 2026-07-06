import { cn } from '../../lib/utils.js';
import { Breadcrumb } from './breadcrumb.js';
import type { BreadcrumbItem } from './breadcrumb.js';

interface PageHeaderProps {
  title:        string;
  description?: string;
  breadcrumb?:  BreadcrumbItem[];
  actions?:     React.ReactNode;
  className?:   string;
}

export function PageHeader({ title, description, breadcrumb, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumb && <Breadcrumb items={breadcrumb} className="mb-2" />}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
