import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MinusCircle,
  Activity,
  ShieldAlert,
} from 'lucide-react';

type StatusTone =
  | 'Active'
  | 'Monitoring'
  | 'Recovered'
  | 'Discharged'
  | 'Upcoming'
  | 'Completed'
  | 'Cancelled'
  | 'Missed'
  | 'Pending'
  | 'Overdue'
  | 'Taken'
  | 'High'
  | 'Medium'
  | 'Low';

const TONE_MAP: Record<
  StatusTone,
  { text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Active: { text: 'text-teal-700', icon: Activity },
  Monitoring: { text: 'text-amber-700', icon: Clock },
  Recovered: { text: 'text-emerald-700', icon: CheckCircle2 },
  Discharged: { text: 'text-slate-600', icon: CheckCircle2 },
  Upcoming: { text: 'text-teal-700', icon: Clock },
  Completed: { text: 'text-emerald-700', icon: CheckCircle2 },
  Cancelled: { text: 'text-slate-500', icon: MinusCircle },
  Missed: { text: 'text-red-700', icon: AlertTriangle },
  Pending: { text: 'text-amber-700', icon: Clock },
  Overdue: { text: 'text-red-700', icon: AlertTriangle },
  Taken: { text: 'text-emerald-700', icon: CheckCircle2 },
  High: { text: 'text-red-700', icon: ShieldAlert },
  Medium: { text: 'text-amber-700', icon: AlertTriangle },
  Low: { text: 'text-teal-700', icon: Activity },
};

export const StatusLabel: React.FC<{ status: StatusTone; className?: string }> = ({
  status,
  className = '',
}) => {
  const cfg = TONE_MAP[status] ?? { text: 'text-slate-700', icon: Activity };
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${cfg.text} ${className}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
};
