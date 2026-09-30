import React, { useState } from 'react';
import type { EmailItem } from '../types';
import { StatusBadge } from './StatusBadge';
import { Search, RefreshCw, CheckCheck, Mail, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  emails: EmailItem[];
  loading: boolean;
  onRefresh: () => void;
  onSearch: (query: string) => void;
}

export const SentTable: React.FC<Props> = ({
  emails,
  loading,
  onRefresh,
  onSearch,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

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
            Sent & Delivered Emails
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete record of delivered emails and any terminal failures
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
                <th className="py-3.5 px-4">Delivered / Updated</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading && emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Loading sent emails...</span>
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <CheckCheck className="w-8 h-8 mx-auto mb-3 opacity-40 text-slate-400" />
                    <p className="text-sm font-medium text-slate-400">No sent emails recorded yet</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Emails that pass their scheduled time and delivery window will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                emails.map((email) => (
                  <React.Fragment key={email.id}>
                    <tr className="hover:bg-slate-900/40 transition-colors group">
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
                        {new Date(email.sentAt || email.updatedAt).toLocaleString(undefined, {
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
                      <td className="py-3.5 px-4 text-right">
                        {email.status === 'FAILED' && email.lastError && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedErrorId(
                                expandedErrorId === email.id ? null : email.id
                              )
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 underline cursor-pointer"
                          >
                            <AlertCircle className="w-3 h-3" />
                            {expandedErrorId === email.id ? 'Hide Error' : 'View Error'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedErrorId === email.id && email.lastError && (
                      <tr className="bg-rose-950/20">
                        <td colSpan={6} className="px-6 py-2.5 text-xs text-rose-300 font-mono border-t border-rose-900/30">
                          <span className="font-semibold text-rose-400">Terminal Failure Reason: </span>
                          {email.lastError} (Attempts made: {email.attempts})
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
