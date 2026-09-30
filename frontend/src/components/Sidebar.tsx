import React from 'react';
import { Calendar, CheckSquare, Plus, Activity } from 'lucide-react';
import { API_BASE_URL } from '../api/client';

export type TabType = 'scheduled' | 'sent';

interface Props {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  onOpenCompose: () => void;
  scheduledCount: number;
  sentCount: number;
}

export const Sidebar: React.FC<Props> = ({
  currentTab,
  onSelectTab,
  onOpenCompose,
  scheduledCount,
  sentCount,
}) => {
  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-950/60 p-4 flex flex-col gap-6 shrink-0">
      {/* Compose Button */}
      <button
        onClick={onOpenCompose}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/35 transition-all cursor-pointer group active:scale-[0.98]"
      >
        <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
        Compose New Email
      </button>

      {/* Navigation Links */}
      <nav className="flex flex-col gap-1.5 flex-1">
        <button
          onClick={() => onSelectTab('scheduled')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
            currentTab === 'scheduled'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4" />
            <span>Scheduled Emails</span>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              currentTab === 'scheduled'
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {scheduledCount}
          </span>
        </button>

        <button
          onClick={() => onSelectTab('sent')}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
            currentTab === 'sent'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/25 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CheckSquare className="w-4 h-4" />
            <span>Sent & Delivered</span>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              currentTab === 'sent'
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {sentCount}
          </span>
        </button>
      </nav>

      {/* Footer Info / Bull Board */}
      <div className="pt-4 border-t border-slate-900 flex flex-col gap-2">
        <a
          href={`${API_BASE_URL}/admin/queues`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>BullMQ Live Queues</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
            Live
          </span>
        </a>

        <div className="px-2 text-[11px] text-slate-500 flex justify-between">
          <span>Worker Concurrency: 5</span>
          <span>Delay: 2000ms</span>
        </div>
      </div>
    </aside>
  );
};
