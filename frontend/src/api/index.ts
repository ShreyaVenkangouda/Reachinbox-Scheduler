import { apiClient } from './client';
import type { User, Sender, EmailItem, SlackStatus, ScheduleBulkPayload } from '../types';

export const authApi = {
  getMe: async (): Promise<{ user: User }> => {
    const { data } = await apiClient.get('/api/auth/me');
    return data;
  },
  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout');
    localStorage.removeItem('reachinbox_token');
  },
};

export const senderApi = {
  getSenders: async (): Promise<Sender[]> => {
    const { data } = await apiClient.get('/api/senders');
    return data;
  },
  createSender: async (payload: { name: string; email: string; hourlyLimit?: number }): Promise<Sender> => {
    const { data } = await apiClient.post('/api/senders', payload);
    return data;
  },
};

export const emailApi = {
  getScheduled: async (): Promise<EmailItem[]> => {
    const { data } = await apiClient.get('/api/emails/scheduled');
    return data;
  },
  getSent: async (): Promise<EmailItem[]> => {
    const { data } = await apiClient.get('/api/emails/sent');
    return data;
  },
  scheduleBulk: async (payload: ScheduleBulkPayload): Promise<{ message: string; count: number; scheduledEmails: Array<{ emailId: string; recipient: string; scheduledAt: string }> }> => {
    const { data } = await apiClient.post('/api/emails/schedule-bulk', payload);
    return data;
  },
  search: async (query: string): Promise<EmailItem[]> => {
    const { data } = await apiClient.get(`/api/emails/search?q=${encodeURIComponent(query)}`);
    return data;
  },
};

export const slackApi = {
  getStatus: async (): Promise<SlackStatus> => {
    const { data } = await apiClient.get('/api/integrations/slack/status');
    return data;
  },
  disconnect: async (): Promise<void> => {
    await apiClient.delete('/api/integrations/slack');
  },
};
