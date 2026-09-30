import { useState, useEffect, useCallback } from 'react';
import type { User, EmailItem, SlackStatus } from './types';
import { authApi, emailApi, slackApi } from './api';
import { Navbar } from './components/Navbar';
import { Sidebar, type TabType } from './components/Sidebar';
import { ScheduledTable } from './components/ScheduledTable';
import { SentTable } from './components/SentTable';
import { ComposeModal } from './components/ComposeModal';
import { LoginPage } from './components/LoginPage';
import { Loader2, CheckCircle2 } from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<TabType>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const [scheduledEmails, setScheduledEmails] = useState<EmailItem[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailItem[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  const [slackStatus, setSlackStatus] = useState<SlackStatus>({ connected: false });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check auth session
  const checkAuth = useCallback(async () => {
    try {
      // Check if URL has token from Google OAuth redirect
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('token');
      if (tokenFromUrl) {
        localStorage.setItem('reachinbox_token', tokenFromUrl);
      }

      if (urlParams.get('slack') === 'connected') {
        showToast('Slack workspace connected successfully! Rate limit alerts enabled.');
      }

      if (tokenFromUrl || urlParams.get('auth') || urlParams.get('slack')) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      const { user: authedUser } = await authApi.getMe();
      setUser(authedUser);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load emails and slack status
  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingEmails(true);
      const [scheduled, sent, slack] = await Promise.all([
        emailApi.getScheduled(),
        emailApi.getSent(),
        slackApi.getStatus(),
      ]);
      setScheduledEmails(scheduled);
      setSentEmails(sent);
      setSlackStatus(slack);
    } catch (err) {
      console.error('Failed to load email scheduler data:', err);
    } finally {
      setLoadingEmails(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
      // Periodic refresh every 10 seconds for live scheduler tracking
      const interval = setInterval(loadData, 10000);
      return () => clearInterval(interval);
    }
  }, [user, loadData]);

  // Search handler (Elasticsearch)
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      loadData();
      return;
    }
    try {
      setLoadingEmails(true);
      const results = await emailApi.search(query);
      if (currentTab === 'scheduled') {
        setScheduledEmails(
          results.filter((e) => e.status === 'SCHEDULED' || e.status === 'PROCESSING')
        );
      } else {
        setSentEmails(
          results.filter((e) => e.status === 'SENT' || e.status === 'FAILED')
        );
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoadingEmails(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
      setUser(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#07090E] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#07090E] text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-3.5 rounded-xl bg-slate-900 border border-emerald-500/50 text-emerald-300 text-xs shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Navbar
        user={user}
        slackStatus={slackStatus}
        onLogout={handleLogout}
        onRefreshSlack={loadData}
      />

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenCompose={() => setIsComposeOpen(true)}
          scheduledCount={scheduledEmails.length}
          sentCount={sentEmails.length}
        />

        {/* Content Area */}
        <main className="flex-1 flex flex-col overflow-y-auto">
          {currentTab === 'scheduled' ? (
            <ScheduledTable
              emails={scheduledEmails}
              loading={loadingEmails}
              onRefresh={loadData}
              onSearch={handleSearch}
            />
          ) : (
            <SentTable
              emails={sentEmails}
              loading={loadingEmails}
              onRefresh={loadData}
              onSearch={handleSearch}
            />
          )}
        </main>
      </div>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          showToast('Emails scheduled successfully!');
          loadData();
          setCurrentTab('scheduled');
        }}
      />
    </div>
  );
}

export default App;
