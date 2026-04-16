# WorkHub Project Report
Generated: 2026-01-11

## Summary
WorkHub is a role-based IT workshop and employee management OS that combines attendance, task tracking, communication, and analytics into a single dashboard experience.

## Stack
- Frontend: Next.js 16, React 18, Tailwind CSS, Zustand, Axios, socket.io-client
- Backend: Express, MongoDB (or MongoMemoryServer), Socket.IO, JWT auth, Multer, PDFKit
- Realtime: Socket.IO for presence and WebRTC signaling

## Core Features
- Auth and RBAC: admin, manager, hr, employee, auditor roles
- Work mode: start/stop sessions, active page tracking, idle time recording
- Tasks and projects: assignment, status updates, comments, attachments
- Attendance and logs: daily logs, summaries, reports (daily/weekly/team)
- Calls and chat: WebRTC signaling, call logs, call-side chat, direct messages
- Collaboration: strategy room messages, file handoffs, announcements
- Settings and alerts: idle thresholds, presence monitoring, alerts

## Local Run
1. Backend: `cd backend && npm install && npm run dev` (defaults to port 5000)
2. Frontend: `cd frontend && npm install && npm run dev` (defaults to port 3000)
3. Backend uses in-memory MongoDB if `MONGO_URI` is unset or `memory`
4. Frontend reads `NEXT_PUBLIC_API_URL` from `.env.local` (defaults to `https://zettalogix-workos.onrender.com/api`)

## Demo Accounts (seeded)
- admin@workos.dev / Admin@123
- manager@workos.dev / Manager@123
- hr@workos.dev / Hr@123456
- auditor@workos.dev / Auditor@123
- eli@workos.dev / Employee@123
- nia@workos.dev / Employee@456

## Recent Fixes
- WebRTC permission prompt now triggers on user action before dialing/accepting.
- Outgoing call cancel works during ringing/outgoing state.
- Admin dashboard stops repeating 403 calls and shows an access warning when not authorized.

## Known Gaps / Risks
- No automated backend or e2e tests are defined; lint only.
- WebRTC requires mic/camera permission and may be blocked by browser settings.
- TURN credentials are needed for restricted networks.
- Tokens are stored in localStorage, which increases XSS risk.

## Testing
- Frontend lint: `npm run lint` (pass)
