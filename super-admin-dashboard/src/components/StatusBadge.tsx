import React from 'react';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  suspended: 'bg-red-500/15 text-red-300 border border-red-500/30',
  cancelled: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
  past_due: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
};

const normalizeStatus = (value?: string | null) => (value || 'pending').toLowerCase();

const StatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const normalized = normalizeStatus(status);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[normalized] || STATUS_STYLES.pending}`}>
      {normalized.replace('_', ' ')}
    </span>
  );
};

export default StatusBadge;
