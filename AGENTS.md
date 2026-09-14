# AI Placement Compass

Standalone **React (Vite) + Express REST API + MongoDB** application.

## Architecture

- **Frontend** (`client/`): React 19 + Vite + wouter + TanStack Query + Tailwind/shadcn. Calls the API via axios (`client/src/lib/api.ts`). Dev server runs on port 5173 and proxies `/api` and `/uploads` to the API server.
- **Backend** (`server/`): Express REST API + Mongoose (MongoDB). Runs on port 3001.
- **Shared** (`shared/`): Constants and TypeScript types shared between frontend and backend.

## Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

## Setup

1. Copy `.env.example` to `.env` and fill in values (MongoDB URI, JWT secret, OpenAI key).
2. Install dependencies: `npm install`
3. Start MongoDB locally (e.g. `mongod`) or set `MONGODB_URI` to an Atlas connection string.

## Development

```
npm run dev
```

Runs both the API server (port 3001) and the Vite dev server (port 5173) concurrently. Open http://localhost:5173.

- `npm run dev:server` — API server only
- `npm run dev:client` — Vite frontend only

## Production

```
npm run build
npm start
```

Builds the React app into `dist/public/` and bundles the Express server into `dist/index.js`. In production the Express server serves the built React app and the API from port 3001.

## Scripts

- `npm run dev` — start both frontend and backend in dev mode
- `npm run build` — build frontend + bundle server
- `npm start` — start production server
- `npm run check` — TypeScript typecheck
- `npm run format` — prettier
- `npm test` — vitest

## REST API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | - | Register with name/email/password |
| POST | `/api/auth/login` | - | Login with email/password |
| POST | `/api/auth/logout` | - | Clear session |
| GET | `/api/auth/me` | - | Current user (null if logged out) |
| GET | `/api/profile/me` | user | Current user profile |
| PUT | `/api/profile/me` | user | Update profile |
| POST | `/api/resume/extract-skills` | user | Upload resume + extract skills via LLM |
| PUT | `/api/resume/save-edits` | user | Save edited skill extraction |
| POST | `/api/support/chat` | user | Help-center chat with LLM |
| GET | `/api/referrals/dashboard` | user | Referral rewards, withdrawals, leaderboard, UPI |
| POST | `/api/referrals/verify-upi` | user | Verify a UPI ID |
| POST | `/api/referrals/request-withdrawal` | user | Request a withdrawal |
| GET | `/api/admin/withdrawals` | admin | All withdrawal requests |
| PUT | `/api/admin/withdrawals` | admin | Update withdrawal status |
| GET | `/api/system/health` | - | Health check |
| GET | `/api/health` | - | Health check |

## Notes

- Auth uses JWT in an httpOnly cookie (email + password with bcrypt). The first registered user is NOT automatically admin — set `role: "admin"` in MongoDB to grant admin access.
- Resume skill extraction and support chat require an OpenAI-compatible LLM (`OPENAI_API_KEY`). Set `OPENAI_API_BASE_URL` and `OPENAI_MODEL` to use a different provider.
- Uploaded resumes are stored on local disk in `uploads/` and served at `/uploads/`. For the LLM to read uploaded resumes it needs `PUBLIC_BASE_URL` set to a publicly reachable URL (the LLM cannot fetch `localhost`).
