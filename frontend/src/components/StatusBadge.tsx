import React from 'react';
import type { EmailStatus } from '../types';
import { Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  status: EmailStatus;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  switch (status) {
    case 'SCHEDULED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-950/60 text-blue-400 border border-blue-800/50">
          <Clock className="w-3.5 h-3.5" />
          Scheduled
        </span>
      );
    case 'PROCESSING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/60 text-amber-400 border border-amber-800/50 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Processing
        </span>
      );
    case 'SENT':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Sent
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/60 text-rose-400 border border-rose-800/50">
          <AlertCircle className="w-3.5 h-3.5" />
          Failed
        </span>
      );
    default:
      return null;
  }
};
