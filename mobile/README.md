# Student Care Help — Mobile App

React Native (Expo) port of the `client/` web app. It talks to the **same Express REST API** in `server/` — no backend duplication.

## Prerequisites

- Node.js 20+
- The existing API server running (`npm run dev:server` in the repo root)
- Expo Go app on your phone (easiest) **or** an Android emulator / iOS simulator

## Quick start

```bash
cd mobile
npm install
npm start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## API URL configuration

The app resolves the API base URL in this order:

1. `app.json → expo.extra.apiUrl`
2. `EXPO_PUBLIC_API_URL` (copy `.env.example` → `.env`)
3. Dev default: the LAN host of the Expo dev server on port `3001` — works out of the box for physical devices on the same Wi-Fi.
4. Emulator fallbacks: `http://10.0.2.2:3001` (Android), `http://localhost:3001` (iOS sim).

Example `.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:3001
```

For production builds, set `EXPO_PUBLIC_API_URL` in `eas.json` (already stubbed) or `expo.extra.apiUrl` in `app.json`.

## Authentication

The web app uses an httpOnly cookie. Mobile stores the session JWT in
`expo-secure-store` and sends it as `Authorization: Bearer <token>`. The server
accepts both (`server/auth.ts`), and returns the token in the
`x-session-token` response header on login/register. Logout and session-expiry
(401) clear the stored token and return to the auth screen automatically.

## Building

```bash
# Android APK (internal testing)
npx eas-cli build --platform android --profile preview

# iOS
npx eas-cli build --platform ios --profile preview
```

## Screens

| Web view (sidebar)      | Mobile location                          |
|-------------------------|------------------------------------------|
| Overview                | Tab: Overview                            |
| Skill roadmap           | Tab: Roadmap                             |
| Job matches             | Tab: Matches                             |
| Refer & Earn            | Tab: Refer                               |
| My profile + resume     | Tab: Profile                             |
| Practice room           | Stack screen (quick action on Overview)  |
| Admin withdrawals       | Stack screen (admin-only quick action)   |
| Help Center drawer      | Modal (life-buoy icon in header)         |
| Notifications panel     | Modal (bell icon in header)              |
