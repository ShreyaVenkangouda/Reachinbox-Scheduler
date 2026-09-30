import React, { useState } from 'react';
import type { User, SlackStatus } from '../types';
import { API_BASE_URL } from '../api/client';
import { slackApi } from '../api';
import { LogOut, Send, CheckCircle2, MessageSquare, ExternalLink } from 'lucide-react';

interface Props {
  user: User;
  slackStatus: SlackStatus;
  onLogout: () => void;
  onRefreshSlack: () => void;
}

export const Navbar: React.FC<Props> = ({ user, slackStatus, onLogout, onRefreshSlack }) => {
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnectSlack = () => {
    window.location.href = `${API_BASE_URL}/api/integrations/slack/connect`;
  };

  const handleDisconnectSlack = async () => {
    try {
      setDisconnecting(true);
      await slackApi.disconnect();
      onRefreshSlack();
    } catch (err) {
      console.error('Failed to disconnect Slack:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Send className="w-5 h-5 text-white -rotate-12" />
        </div>
        <div>
          <span className="font-bold text-base tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            ReachInbox
          </span>
          <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Scheduler
          </span>
        </div>
      </div>

      {/* Right actions: Slack + User Info */}
      <div className="flex items-center gap-4">
        {/* Slack Connection */}
        <div className="flex items-center gap-2">
          {slackStatus.connected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">
                Slack: {slackStatus.teamName || 'Connected'}
              </span>
              <button
                onClick={handleDisconnectSlack}
                disabled={disconnecting}
                className="ml-2 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Disconnect Slack"
              >
                {disconnecting ? '...' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectSlack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4A154B]/30 hover:bg-[#4A154B]/50 border border-[#E01E5A]/30 text-xs font-medium text-purple-300 transition-all cursor-pointer shadow-sm"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#ECB22E]" />
              Connect Slack
            </button>
          )}
        </div>

        {/* Bull Board Quick Link */}
        <a
          href={`${API_BASE_URL}/admin/queues`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-300 transition-colors"
          title="Open BullMQ Queue Dashboard"
        >
          Bull Board
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-800" />

        {/* User Profile */}
        <div className="flex items-center gap-3">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || user.email}
              className="w-8 h-8 rounded-full border border-slate-700 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center font-bold text-xs text-blue-300">
              {(user.name || user.email)[0].toUpperCase()}
            </div>
          )}

          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-200">
              {user.name || 'User'}
            </span>
            <span className="text-[11px] text-slate-400 max-w-[140px] truncate">
              {user.email}
            </span>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="p-2 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
