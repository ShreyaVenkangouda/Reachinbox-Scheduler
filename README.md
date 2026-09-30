# ReachInbox Email Scheduler

A full-stack distributed email job scheduler built as a hiring assignment.

## Features

### Backend
| Feature | Detail |
|---|---|
| **Scheduling API** | `POST /api/emails/schedule` and `POST /api/emails/schedule-bulk` |
| **PostgreSQL persistence** | All email records persisted before queueing |
| **BullMQ delayed jobs** | Exact-time delivery via Redis-backed priority queue |
| **Redis persistence** | Delayed jobs survive Express restarts — no cron needed |
| **Worker concurrency** | Configurable via `WORKER_CONCURRENCY` (default 5) |
| **Minimum send spacing** | Redis Lua-scripted global throttle (`MIN_SEND_DELAY_MS`) |
| **Hourly rate limiting** | Per-sender Redis counter with atomic Lua script (`MAX_EMAILS_PER_HOUR_PER_SENDER`) |
| **Rate-limit rescheduling** | Emails exceeding limit are rescheduled to next hour window without dropping |
| **Idempotency** | Deterministic BullMQ jobId = email.id; atomic `SCHEDULED → PROCESSING` DB claim |
| **Retries** | BullMQ exponential backoff (3 attempts); `PROCESSING → SCHEDULED` on failure |
| **Ethereal SMTP** | Fake inbox delivery with preview URL logged |
| **Elasticsearch** | Email indexing on create/status change; full-text search across recipient/subject/body |
| **Bull Board** | Live BullMQ queue dashboard at `/admin/queues` |
| **Slack OAuth** | Real OAuth 2.0 flow; token stored per user |
| **Slack notifications** | Rate-limit alert sent once per sender per window (Redis deduplication) |
| **Google OAuth** | Real OAuth 2.0; user upserted; JWT session cookie |
| **Multiple senders** | `GET /api/senders`, `POST /api/senders`; each with configurable `hourlyLimit` |
| **Graceful shutdown** | SIGINT/SIGTERM closes worker, queue, Redis, Prisma cleanly |

### Frontend
| Feature | Detail |
|---|---|
| **Google login** | Real OAuth redirect to backend |
| **Dashboard header** | Avatar, name, email, logout, Slack connect/disconnect, Bull Board link |
| **Compose modal** | Sender selector, subject, body, CSV/TXT upload, recipient parser, start time, delay, hourly limit |
| **Client-side parser** | Regex extraction + deduplication; live count display |
| **Scheduled emails** | Live-updating table with status badges, search |
| **Sent emails** | Table with SENT/FAILED badges; expandable error detail for FAILED |
| **Elasticsearch search** | Query bar in both tables with DB fallback |
| **Loading/error/empty states** | All table states handled |
| **10-second auto-refresh** | Dashboard polls API every 10 seconds |

---

## Architecture

```
React (Vite + Tailwind)
  |  ← REST + HTTP-only JWT cookie
Express (TypeScript)
  |
  ├── PostgreSQL (Prisma)   ← email records, users, senders, slack tokens
  |
  ├── Redis / BullMQ        ← delayed job queue
  |     └── Worker          ← rate-limit check → global throttle → Nodemailer/Ethereal
  |
  ├── Elasticsearch         ← email index for full-text search
  |
  ├── Google OAuth          ← /auth/google → /auth/google/callback
  |
  └── Slack API             ← /api/integrations/slack/connect → /callback → chat.postMessage
```

---

## Scheduling Flow

```
POST /api/emails/schedule-bulk
  → Validate sender ownership
  → Deduplicate recipients
  → For each recipient:
      → prisma.email.create (status=SCHEDULED)
      → emailQueue.add({ emailId }, { delay, jobId: email.id })
      → index in Elasticsearch
  → Return summary

BullMQ Worker fires when delay expires:
  → prisma.email.findUnique (check SENT guard)
  → prisma.email.updateMany (SCHEDULED → PROCESSING, atomic)
  → Per-sender rate limit check (Redis Lua)
      → If exceeded: revert to SCHEDULED, reschedule job to next window, notify Slack
  → Global throttle (Redis Lua – reserve send slot)
  → Wait if slot is in future
  → sendEmail() via Nodemailer/Ethereal
  → prisma.email.update (status=SENT, sentAt=now)
  → index updated document in Elasticsearch
```

---

## Persistence on Restart

BullMQ delayed jobs are stored entirely in Redis (sorted set keyed by run-at timestamp). PostgreSQL stores the application state. When Express/Node restarts:

1. The Worker reconnects to Redis
2. Redis still holds all delayed jobs (Redis persisted them while the process was down)
3. Jobs execute at their original scheduled time
4. **No cron job recreates the schedule on startup**
5. The only invariant required: Redis and PostgreSQL must remain running

---

## Idempotency

- **Deterministic jobId**: Every BullMQ job uses `jobId: email.id`. BullMQ silently deduplicates if the same ID is added again.
- **Atomic DB claim**: `prisma.email.updateMany({ where: { id, status: "SCHEDULED" } })` — only the first worker that transitions SCHEDULED → PROCESSING is permitted to call the SMTP transport.
- **SENT guard**: If `email.status === "SENT"`, the worker returns immediately without sending.
- **Retry compatibility**: On SMTP failure, the worker reverts DB status to `SCHEDULED` (so the next BullMQ retry can claim it), stores `lastError`, and re-throws so BullMQ handles exponential backoff.

> **Honest caveat**: There is one unavoidable edge case — if the process crashes after SMTP accepts the message but before the DB is updated to SENT, the email may be delivered twice on retry. This is inherent to distributed systems without a two-phase-commit between SMTP and DB.

---

## Concurrency

`WORKER_CONCURRENCY=5` (default) means up to 5 jobs process in parallel within a single worker process. Race conditions are eliminated by the atomic PostgreSQL `updateMany` claim — only one concurrent execution can transition `SCHEDULED → PROCESSING` for the same email.

---

## Minimum Send Delay

A Redis Lua script (`global:throttle:next_allowed_send_time`) atomically reserves a send slot spaced by `MIN_SEND_DELAY_MS` milliseconds. Each worker reads the current "next allowed" timestamp, bumps it by the delay, and waits if its reserved slot is in the future. This ensures globally ordered spacing even across multiple workers or processes.

```
Email A → slot reserved at T+0
Email B → slot reserved at T+2000
Email C → slot reserved at T+4000
```

---

## Hourly Rate Limiting

- **Per sender**: Key pattern `email-rate:<senderId>:<windowStart>`
- **Atomic Redis counter**: Lua script does `GET → check limit → INCR` atomically; sets `PEXPIRE` on first increment
- **Window**: Configurable via `RATE_LIMIT_WINDOW_MS` (default `3600000` = 1 hour; set to `60000` for 1-minute demo windows)
- **When limit reached**:
  1. DB status reverts to `SCHEDULED`; `scheduledAt` updated to next window start
  2. New BullMQ delayed job scheduled for next window (with new jobId `email.id:window:<windowStart>`)
  3. Slack notification sent once per sender per window (Redis `NX` deduplication key)
- **Multi-worker safe**: All state is in Redis, no in-memory counters

---

## Slack OAuth & Notifications

1. User clicks "Connect Slack" → redirected to `/api/integrations/slack/connect`
2. Backend builds Slack OAuth URL with `chat:write` scope; state = userId
3. Slack redirects to `/api/integrations/slack/callback?code=...&state=userId`
4. Backend exchanges code for access token, stores in `SlackIntegration` table
5. When a sender's rate limit is first hit in a given window: `chat.postMessage` is called via Slack Web API
6. Deduplication key `slack-rate-notified:<senderId>:<windowStart>` with TTL prevents spam
7. If Slack is not connected: rate limiting still works; notification is silently skipped

---

## Elasticsearch

- Index: `emails`
- Indexed fields: `id`, `userId`, `senderId`, `recipient`, `subject`, `body`, `status`, `scheduledAt`, `sentAt`, `createdAt`
- Emails indexed on creation and on status updates (SENT/FAILED)
- Search: `GET /api/emails/search?q=<query>` — multi-match across `recipient`, `subject`, `body` with fuzzy matching
- Results scoped to authenticated user via `bool.filter.term.userId`
- **Graceful degradation**: If Elasticsearch is unavailable, search falls back to PostgreSQL `ILIKE` query; indexing failures are logged and non-fatal

---

## Setup

### Prerequisites

- Docker + Docker Compose
- Node.js 20+
- npm

### 1. Start Infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL (port 5434), Redis (6379), Elasticsearch (9200).

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SLACK_CLIENT_ID, SLACK_CLIENT_SECRET,
# SMTP_HOST/USER/PASSWORD (from https://ethereal.email/create), SESSION_SECRET

npm install
npx prisma db push
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Express server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch URL |
| `WORKER_CONCURRENCY` | `5` | BullMQ worker concurrency |
| `MIN_SEND_DELAY_MS` | `2000` | Min ms between email sends (global) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `200` | Per-sender hourly limit |
| `RATE_LIMIT_WINDOW_MS` | `3600000` | Rate limit window in ms (use `60000` for demo) |
| `SMTP_HOST` | — | SMTP hostname (Ethereal: `smtp.ethereal.email`) |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASSWORD` | — | SMTP password |
| `SMTP_FROM` | — | From display address |
| `GOOGLE_CLIENT_ID` | — | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth 2.0 client secret |
| `GOOGLE_CALLBACK_URL` | — | Must match Google Console redirect URI |
| `SLACK_CLIENT_ID` | — | Slack App client ID |
| `SLACK_CLIENT_SECRET` | — | Slack App client secret |
| `SLACK_REDIRECT_URI` | — | Must match Slack App redirect URL |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend origin for CORS + redirects |
| `SESSION_SECRET` | — | JWT signing secret |
| `VITE_API_URL` | `http://localhost:5000` | Frontend: backend base URL |

---

## URLs

| Resource | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend health | http://localhost:5000/health |
| Bull Board | http://localhost:5000/admin/queues |
| Google OAuth start | http://localhost:5000/auth/google |
| Slack OAuth start | http://localhost:5000/api/integrations/slack/connect |
| Email search | http://localhost:5000/api/emails/search?q=hello |
| Prisma Studio | `npx prisma studio` (port 5555) |

---

## Demo Checklist

See [DEMO.md](./DEMO.md) for the full 5-minute demo script.

---

## Assumptions & Trade-offs

| Decision | Rationale |
|---|---|
| JWT in HTTP-only cookie + localStorage Bearer | Simple for local dev; cookie preferred for security |
| BullMQ jobId = email.id | Prevents duplicate queue entries; BullMQ deduplicates silently |
| `RATE_LIMIT_WINDOW_MS` env | Makes demo viable without waiting 1 hour |
| Elasticsearch fallback to DB | Scheduler reliability > search availability |
| Ethereal SMTP | No real email delivery cost for assignment; `nodemailer.getTestMessageUrl()` gives preview |
| Single Ethereal transport for all senders | Ethereal is a single shared test transport; sender identity is logical only |
| No Passport.js | Direct fetch-based OAuth keeps dependencies minimal |
| `prisma db push` over migrations | Faster for assignment; use `prisma migrate dev` for production |
