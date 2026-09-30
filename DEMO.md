# DEMO.md — 5-Minute Demo Script

## Pre-Demo Checklist (Do Before Presenting)

- [ ] `docker compose up -d` — PostgreSQL, Redis, Elasticsearch running
- [ ] `cd backend && npm run dev` — backend running on :5000
- [ ] `cd frontend && npm run dev` — frontend running on :5173
- [ ] Browser open at http://localhost:5173
- [ ] Ethereal credentials configured in `backend/.env`
- [ ] Google OAuth credentials configured
- [ ] Slack App configured and your workspace ready to receive a message
- [ ] For rate-limit demo: set `RATE_LIMIT_WINDOW_MS=60000` (1 minute) in backend `.env`

---

## Demo Steps (~5 minutes)

### 1. Google Login (30 sec)

- Open http://localhost:5173
- Show the Login page with the "Continue with Google" button
- Click it → Google OAuth screen → Authorize
- Land on dashboard — show **avatar, name, email** in the header

---

### 2. Dashboard Overview (30 sec)

- Point out:
  - **Sidebar**: Scheduled Emails | Sent & Delivered | Compose button
  - **Navbar**: Slack connect status, Bull Board link, logout
- Open **Bull Board** (`http://localhost:5000/admin/queues`) in a new tab — show the live queue dashboard

---

### 3. Compose & Schedule Bulk Emails (1 min)

- Click **"Compose New Email"**
- Select sender (auto-created from Google profile)
- Fill in Subject: `ReachInbox Demo Campaign`
- Fill in Body: `Hello! This is a scheduled test email from ReachInbox.`
- In Recipients box, paste:
  ```
  alice@example.com
  bob@example.com
  charlie@example.com
  ```
- See the **"3 valid recipients detected"** badge update live
- Set **Start Time** = 1 minute from now
- Leave **Delay Between Sends** = 2000ms, **Hourly Limit** = 2 (for rate-limit demo)
- Click **"Schedule 3 Emails"**
- Toast: "Emails scheduled successfully!"

---

### 4. Scheduled Emails Table (30 sec)

- Navigate to **Scheduled Emails** tab
- Show 3 rows with status `SCHEDULED`
- Point out columns: Recipient, Subject, Sender, Scheduled At, Status, Attempts

---

### 5. BullMQ Queue Dashboard (30 sec)

- Switch to the Bull Board tab
- Show **Delayed** count = 3
- Explain: "These 3 jobs are persisted in Redis. If I restart the backend right now, they would still fire at the scheduled time."

---

### 6. Rate Limit in Action (1 min)

> With `RATE_LIMIT_WINDOW_MS=60000` and `hourlyLimit=2`, the first 2 emails will send, the 3rd will be rescheduled.

- Wait until the scheduled time arrives (~1 minute)
- Watch backend logs:
  ```
  Processing email: <id1>   → Email sent ✓
  Processing email: <id2>   → Email sent ✓
  Processing email: <id3>   → Rate limit reached → rescheduling to next window
  ```
- **Sent tab** — shows 2 SENT emails
- **Scheduled tab** — shows 1 SCHEDULED email (rescheduled to +1 minute)
- **Real Slack message** received in your workspace channel:
  > "⚠️ Rate limit reached for sender alice@example.com. Remaining emails have been delayed until the next available hour window."

---

### 7. Ethereal Email Preview (30 sec)

- In backend terminal, find the `Preview URL: https://ethereal.email/message/...` line
- Open it in browser — shows the full email delivered to Ethereal inbox

---

### 8. Elasticsearch Search (30 sec)

- Go to Sent tab
- Type `ReachInbox` in the search bar → press Enter
- Show results filtered via Elasticsearch
- Mention: falls back to PostgreSQL ILIKE if Elasticsearch is unavailable

---

### 9. Restart Persistence (30 sec)

- In the terminal running backend, press `Ctrl+C` — graceful shutdown logged:
  ```
  Received SIGINT. Shutting down gracefully...
  HTTP server closed
  BullMQ worker closed
  Redis connection closed
  Prisma disconnected
  ```
- **Leave Redis and PostgreSQL running**
- `npm run dev` again
- The remaining rescheduled email job is still in Redis — it will fire at its new scheduled time without any API call

---

### 10. Summary

Recap what was demonstrated:

| Requirement | ✓ |
|---|---|
| Google OAuth login | ✓ |
| User avatar/name in header | ✓ |
| Compose + CSV/text recipient upload | ✓ |
| Bulk scheduling to BullMQ | ✓ |
| BullMQ live queue dashboard | ✓ |
| Email delivered to Ethereal | ✓ |
| Restart persistence (no cron) | ✓ |
| Per-sender hourly rate limiting | ✓ |
| Rate-limit rescheduling | ✓ |
| Real Slack notification | ✓ |
| Elasticsearch search | ✓ |

---

## Quick Rate-Limit Demo Setup

In `backend/.env`:
```env
RATE_LIMIT_WINDOW_MS=60000   # 1 minute window instead of 1 hour
```

Set sender `hourlyLimit=2` in the Compose modal before scheduling 3+ emails.

This lets you demonstrate rate limiting in ~2 minutes without waiting an hour.

> **Note**: The production default is `RATE_LIMIT_WINDOW_MS=3600000` (1 hour). The shortened window is only for demo/testing purposes.
