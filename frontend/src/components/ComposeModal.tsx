import React, { useState, useEffect } from 'react';
import type { Sender } from '../types';
import { senderApi, emailApi } from '../api';
import { X, Upload, CheckCircle2, AlertCircle, Loader2, Plus, Clock } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientsText, setRecipientsText] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([]);
  const [ignoredCount, setIgnoredCount] = useState<number>(0);
  
  // Start time: default 1 minute from now
  const defaultStartTime = new Date(Date.now() + 60000).toISOString().slice(0, 16);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [delayBetweenEmailsMs, setDelayBetweenEmailsMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  // New sender inline toggle
  const [showAddSender, setShowAddSender] = useState(false);
  const [newSenderName, setNewSenderName] = useState('');
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderHourlyLimit, setNewSenderHourlyLimit] = useState(2);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load senders
  useEffect(() => {
    if (isOpen) {
      loadSenders();
    }
  }, [isOpen]);

  const loadSenders = async () => {
    try {
      const data = await senderApi.getSenders();
      setSenders(data);
      if (data.length > 0 && !selectedSenderId) {
        setSelectedSenderId(data[0].id);
        setHourlyLimit(data[0].hourlyLimit || 200);
      }
    } catch (err) {
      console.error('Failed to load senders:', err);
    }
  };

  // Client-side parser & deduplicator
  useEffect(() => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = recipientsText.match(emailRegex) || [];
    
    const unique = new Set<string>();
    matches.forEach((m) => unique.add(m.trim().toLowerCase()));

    const uniqueList = Array.from(unique);
    setParsedRecipients(uniqueList);
    setIgnoredCount(Math.max(0, matches.length - uniqueList.length));
  }, [recipientsText]);

  // File upload handler (.csv, .txt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setRecipientsText((prev) => (prev ? `${prev}\n${text}` : text));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Create new sender inline
  const handleCreateSender = async () => {
    if (!newSenderEmail) return;
    try {
      const limitToUse = newSenderHourlyLimit > 0 ? newSenderHourlyLimit : hourlyLimit;
      const created = await senderApi.createSender({
        name: newSenderName || newSenderEmail.split('@')[0],
        email: newSenderEmail,
        hourlyLimit: limitToUse,
      });
      setSenders((prev) => [...prev, created]);
      setSelectedSenderId(created.id);
      setHourlyLimit(created.hourlyLimit);
      setShowAddSender(false);
      setNewSenderName('');
      setNewSenderEmail('');
    } catch (err) {
      setError('Failed to create sender. Please check the email format.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSenderId) {
      setError('Please select or create a sender.');
      return;
    }

    if (parsedRecipients.length === 0) {
      setError('Please provide at least one valid recipient email address.');
      return;
    }

    if (!subject.trim() || !body.trim()) {
      setError('Subject and body cannot be empty.');
      return;
    }

    try {
      setLoading(true);
      await emailApi.scheduleBulk({
        senderId: selectedSenderId,
        recipients: parsedRecipients,
        subject,
        body,
        startTime: new Date(startTime).toISOString(),
        delayBetweenEmailsMs,
        hourlyLimit,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to schedule emails');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Compose & Schedule Emails
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-sm">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 flex items-center gap-2.5 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">Sender Identity</label>
              <button
                type="button"
                onClick={() => setShowAddSender(!showAddSender)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {showAddSender ? 'Cancel' : 'Add New Sender'}
              </button>
            </div>

            {showAddSender ? (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                <input
                  type="text"
                  placeholder="Sender Name (e.g. Sales Team)"
                  value={newSenderName}
                  onChange={(e) => setNewSenderName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="sender@domain.com"
                    value={newSenderEmail}
                    onChange={(e) => setNewSenderEmail(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Limit/hr"
                    value={newSenderHourlyLimit}
                    onChange={(e) => setNewSenderHourlyLimit(Number(e.target.value))}
                    className="w-24 px-2.5 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    title="Hourly Limit"
                  />
                  <button
                    type="button"
                    onClick={handleCreateSender}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={selectedSenderId}
                onChange={(e) => {
                  setSelectedSenderId(e.target.value);
                  const found = senders.find((s) => s.id === e.target.value);
                  if (found) setHourlyLimit(found.hourlyLimit || 200);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500"
              >
                {senders.map((sender) => (
                  <option key={sender.id} value={sender.id}>
                    {sender.name ? `${sender.name} (${sender.email})` : sender.email} — Limit: {sender.hourlyLimit}/hr
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Subject</label>
            <input
              type="text"
              required
              placeholder="Exciting update regarding your ReachInbox campaign..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Body</label>
            <textarea
              required
              rows={4}
              placeholder="Hi there,\n\nWe wanted to share our latest product updates with you..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none font-mono"
            />
          </div>

          {/* Recipients CSV/TXT & Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Recipients (Upload CSV / TXT or Paste)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload .csv / .txt</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              rows={3}
              placeholder="alice@example.com, bob@example.com, charlie@example.com&#10;or upload CSV with email list..."
              value={recipientsText}
              onChange={(e) => setRecipientsText(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 text-xs placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none font-mono"
            />

            {/* Live Parser Detection Badge */}
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {parsedRecipients.length} valid recipient{parsedRecipients.length === 1 ? '' : 's'} detected
              </span>
              {ignoredCount > 0 && (
                <span className="text-slate-500">
                  ({ignoredCount} duplicates / invalid entries ignored)
                </span>
              )}
            </div>
          </div>

          {/* Scheduling Configuration Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Delay Between Sends (ms)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={delayBetweenEmailsMs}
                onChange={(e) => setDelayBetweenEmailsMs(Number(e.target.value))}
                className="w-full px-2.5 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Hourly Limit / Sender
              </label>
              <input
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full px-2.5 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || parsedRecipients.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Scheduling...' : `Schedule ${parsedRecipients.length} Emails`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
