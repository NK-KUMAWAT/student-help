# AI Placement Compass

Standalone **React (Vite) + Express REST API + MongoDB** application.

## Architecture

- **Frontend** (`client/`): React 19 + Vite + wouter + TanStack Query + Tailwind/shadcn. Independent package with its own `package.json`, `tsconfig.json`, `vite.config.ts`, and `components.json`. Calls the API via axios (`client/src/lib/api.ts`). Dev server runs on port 5173 and proxies `/api` and `/uploads` to the API server.
- **Backend** (`server/`): Express REST API + Mongoose (MongoDB). Independent package with its own `package.json` and `tsconfig.json`. Runs on port 3001. Env file: `server/.env`. Uploaded files: `server/uploads/`.
- **Shared** (`shared/`): Constants and TypeScript types shared between frontend and backend. Not a package — the client imports it via the `@shared` vite/tsconfig alias (`../shared`), the server imports it with relative paths (`../shared/...`).
- **Root `package.json`**: orchestration only (concurrently/prettier). Each app installs and runs on its own.

## Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

## Setup

1. Copy `server/.env.example` to `server/.env` and fill in values (MongoDB URI, JWT secret, OpenAI key).
2. Install dependencies for everything: `npm run install:all` (or `npm install` at root plus inside `client/` and `server/`).
3. Start MongoDB locally (e.g. `mongod`) or set `MONGODB_URI` in `server/.env` to an Atlas connection string.

## Development

Each app can be run on its own:

```
cd server && npm install && npm run dev   # API on http://localhost:3001
cd client && npm install && npm run dev   # Vite on http://localhost:5173
```

Or run both together from the repo root:

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

Builds the React app into `client/dist/`, copies it to `server/public/`, and bundles the Express server into `server/dist/index.js`. In production the Express server serves the built React app from `server/public/` (override with `STATIC_DIR`) and the API from port 3001.

## Scripts (root)

- `npm run dev` — start both frontend and backend in dev mode
- `npm run build` — build frontend + bundle server + copy client build into `server/public/`
- `npm start` — start production server
- `npm run check` — TypeScript typecheck (client + server)
- `npm run format` — prettier
- `npm run install:all` — install deps for root, client, and server

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
| POST | `/api/ai-agent/chat` | user | Practice Room AI agent (Nk) — resume-grounded career/interview chat. `{message, conversationId?, stream?}` — `stream:true` returns SSE (`meta`/`delta`/`done`/`error` events) |
| GET | `/api/referrals/dashboard` | user | Referral rewards, withdrawals, leaderboard, UPI |
| POST | `/api/referrals/verify-upi` | user | Verify a UPI ID |
| POST | `/api/referrals/request-withdrawal` | user | Request a withdrawal |
| GET | `/api/admin/withdrawals` | admin | All withdrawal requests |
| PUT | `/api/admin/withdrawals` | admin | Update withdrawal status |
| GET | `/api/system/health` | - | Health check |
| GET | `/api/health` | - | Health check |

## Mobile app (`mobile/`)

Standalone **Expo (React Native)** app that reuses the same REST API. It is NOT part of the root npm workspace — install/run it inside `mobile/`:

```
cd mobile && npm install && npm start
```

- Auth: the web uses an httpOnly cookie; the mobile app reads the `x-session-token` response header on login/register, stores it in `expo-secure-store`, and sends it back as `Authorization: Bearer <token>` (accepted by `attachUser` in `server/src/auth.ts`).
- API base URL resolution in `mobile/src/config.ts`: `app.json extra.apiUrl` → `EXPO_PUBLIC_API_URL` → dev-server LAN host → emulator fallbacks (`10.0.2.2` on Android).
- See `mobile/README.md` for screens, build (EAS), and env config.

## Notes

- Auth uses JWT in an httpOnly cookie (email + password with bcrypt). The first registered user is NOT automatically admin — set `role: "admin"` in MongoDB to grant admin access.
- Resume skill extraction and support chat require an OpenAI-compatible LLM (`OPENAI_API_KEY`). Set `OPENAI_API_BASE_URL` and `OPENAI_MODEL` in `server/.env` to use a different provider.
- Uploaded resumes are stored on local disk in `server/uploads/` and served at `/uploads/`. Resume text is extracted locally (`pdf-parse`) and sent to the LLM as text — no publicly reachable URL is needed.
