import React, { useState } from 'react';
import type { EmailItem } from '../types';
import { StatusBadge } from './StatusBadge';
import { Search, RefreshCw, Calendar, Mail, Loader2 } from 'lucide-react';

interface Props {
  emails: EmailItem[];
  loading: boolean;
  onRefresh: () => void;
  onSearch: (query: string) => void;
}

export const ScheduledTable: React.FC<Props> = ({
  emails,
  loading,
  onRefresh,
  onSearch,
}) => {
  const [searchInput, setSearchInput] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    onSearch('');
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden">
      {/* Title & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Scheduled Emails
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Delayed BullMQ jobs queued and scheduled for automated delivery
          </p>
        </div>

        {/* Search Bar + Refresh */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search via Elasticsearch..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </form>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col shadow-xl">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/50 text-slate-400 font-medium">
                <th className="py-3.5 px-4">Recipient</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Sender</th>
                <th className="py-3.5 px-4">Scheduled At</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Attempts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading && emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Loading scheduled emails...</span>
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40 text-slate-400" />
                    <p className="text-sm font-medium text-slate-400">No scheduled emails found</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Click "Compose New Email" to schedule single or bulk email campaigns.
                    </p>
                  </td>
                </tr>
              ) : (
                emails.map((email) => (
                  <tr
                    key={email.id}
                    className="hover:bg-slate-900/40 transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-medium text-slate-200 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate max-w-[200px]">{email.recipient}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-[260px] truncate">
                      {email.subject}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {email.sender?.name || email.sender?.email || 'Default'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(email.scheduledAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={email.status} />
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-400 font-mono">
                      {email.attempts}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
