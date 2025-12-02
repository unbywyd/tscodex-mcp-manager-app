import * as React from 'react';
import { CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<AlertVariant, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-emerald-950/30',
    border: 'border-emerald-900',
    icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
  },
  error: {
    bg: 'bg-red-950/30',
    border: 'border-red-900',
    icon: <XCircle className="w-5 h-5 text-red-400" />,
  },
  warning: {
    bg: 'bg-amber-950/30',
    border: 'border-amber-900',
    icon: <AlertCircle className="w-5 h-5 text-amber-400" />,
  },
  info: {
    bg: 'bg-blue-950/30',
    border: 'border-blue-900',
    icon: <Info className="w-5 h-5 text-blue-400" />,
  },
};

export function Alert({ variant = 'info', title, children, className }: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn('card p-4', styles.bg, styles.border, className)}>
      <div className="flex items-start gap-3">
        {styles.icon}
        <div className="flex-1 min-w-0">
          {title && <p className="font-medium mb-1">{title}</p>}
          <div className="text-sm text-gray-300">{children}</div>
        </div>
      </div>
    </div>
  );
}
