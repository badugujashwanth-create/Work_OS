# WorkHub - IT Workshop Management System

The WorkHub stack now ships a full IT-Workshop / Employee Management cockpit with multi-role access, advanced attendance tracking, and productivity analytics. The project contains two apps:

- **Backend** - Express + MongoDB API (`/backend`)
- **Frontend** - Next.js 14 dashboard (`/frontend`)

## Getting Started

```bash
# install dependencies
cd backend && npm install
cd ../frontend && npm install

# run dev servers
cd ../backend && npm run dev
cd ../frontend && npm run dev
```

Set the following environment variables (see `/backend/.env.example` and `/frontend/.env.local`):

- `PORT`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`
- `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_DAYS`
- `OPENAI_API_KEY` (optional for AI summaries)

Frontend reads `NEXT_PUBLIC_API_URL` from `.env.local` to reach the API; it defaults to `https://zettalogix-workos.onrender.com/api` if you leave it unset.

Auth notes:
- For a fresh database, set `ALLOW_BOOTSTRAP_ADMIN=true` to allow the first registration to be an admin, then disable it.

### TURN for calls

To enable TURN for WebRTC calls, set the following in `frontend/.env.local` (or host env vars). If unset, calls fall back to STUN only.

```
NEXT_PUBLIC_TURN_URL=turn:turn.example.com:3478
NEXT_PUBLIC_TURN_USER=your-turn-username
NEXT_PUBLIC_TURN_PASS=your-turn-password
```

## How to run locally

1. Start the API: `cd backend && npm install && npm run dev` (uses `PORT` from `.env`, defaults to `5000`).
2. Start the frontend: `cd frontend && npm install && npm run dev` (use `npm run dev`, not `npm start`).
3. (Optional) Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` to point at your API; leave it empty to use `https://zettalogix-workos.onrender.com/api`.

## Client Guide

For a client-ready overview and role-based walkthrough, see `docs/CLIENT_GUIDE.md`.

## Backend Highlights

- **Auth & RBAC** - Access/refresh tokens, refresh rotation, and role guard middleware (`admin`, `manager`, `employee`, `hr`).
- **Models** - Users, Roles, Attendance, Projects, Tasks (attachments & history), WorkSessions, AuditLog, RefreshToken, etc.
- **Modules** - Attendance APIs (check-in/out, break tracking, overrides), Project management, enhanced Admin analytics (`/api/admin/dashboard`), audit logging, rate limiting.
- **Seed data** - In-memory Mongo seeds now include multiple roles, projects, attendance history, and activity logs.

## Frontend Highlights

- **Admin dashboard** - Live metrics, task status board, focus trend chart, attendance rollup, alert stream, and audit feed.
- **Employee dashboard** - Task board plus attendance timeline & work-mode metrics.
- **Services/Stores** - Auto token refresh via Axios interceptors, Zustand auth store aware of refresh tokens, new attendance/project services.

## Testing

1. `npm run dev` in `/backend` launches the API on port 5000.
2. `npm run dev` in `/frontend` launches Next.js on port 3000 (configured to talk to the API).
3. Demo logins (seeded): `admin@workos.dev`, `manager@workos.dev`, `hr@workos.dev`, `eli@workos.dev`, `nia@workos.dev` (see terminal output after `seedTempData` runs).

Backfill tasks, attendance overrides, and exports are exposed in the Admin console once logged in as an administrator.
