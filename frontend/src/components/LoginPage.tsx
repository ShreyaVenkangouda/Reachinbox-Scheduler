import React from 'react';
import { API_BASE_URL } from '../api/client';
import { Send, Clock, ShieldCheck, Search, MessageSquare } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-[#07090E] p-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative z-10 text-center">
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 mx-auto flex items-center justify-center shadow-xl shadow-blue-500/25 mb-5">
          <Send className="w-7 h-7 text-white -rotate-12" />
        </div>

        <h1 className="text-2xl font-bold text-white tracking-tight">
          ReachInbox Scheduler
        </h1>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          Distributed Email Job Scheduler with BullMQ, Redis persistence, hourly rate limits, Slack notifications, and Elasticsearch.
        </p>

        {/* Google OAuth Login Button */}
        <div className="mt-8">
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all shadow-lg shadow-white/10 hover:shadow-white/20 active:scale-[0.98] cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Feature Badges Grid */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-2 gap-2.5 text-left">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px] text-slate-300">
            <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>BullMQ Delayed Queue</span>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px] text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Per-Sender Rate Limiting</span>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px] text-slate-300">
            <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Real Slack Alerts</span>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px] text-slate-300">
            <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Elasticsearch Search</span>
          </div>
        </div>
      </div>

      <div className="mt-6 text-xs text-slate-500 text-center">
        <span>ReachInbox Full-Stack Hiring Assignment &bull; Built with TypeScript, React, Express, Prisma & Redis</span>
      </div>
    </div>
  );
};
