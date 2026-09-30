export interface User {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
}

export interface Sender {
  id: string;
  name?: string | null;
  email: string;
  hourlyLimit: number;
  createdAt: string;
}

export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface EmailItem {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  attempts: number;
  lastError?: string | null;
  bullJobId?: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: string;
    name?: string | null;
    email: string;
  };
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
  channelId?: string;
}

export interface ScheduleBulkPayload {
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmailsMs: number;
  hourlyLimit?: number;
}
