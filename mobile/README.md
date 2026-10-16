# Toepen — Mobile app (iOS + Android)

A native React Native (Expo) client for the online Dutch café card game
**Toepen**. It talks to the same authoritative Node/WebSocket backend as the web
app, so players on **different devices and networks play in the same live game**.

- **Accounts** — register/login (JWT), saved stats & game history, and
  reconnect to a live table you're already seated at.
- **Cross-device multiplayer** — create a table, share the game code, and anyone
  on iOS/Android (or the web app) can join the same round.
- Same brown-café look as the web app, laid out for phones.

## Stack

| Piece | Tech |
|-------|------|
| App | Expo SDK 57 · React Native 0.86 · React 19 (New Architecture) |
| Navigation | React Navigation v7 (native-stack + bottom-tabs) |
| Realtime | WebSocket (`/ws`), REST (`/api`) — the existing Toepen server |
| Auth token | `expo-secure-store` · session state in an `AuthProvider` |

## Configure the server URL

The app needs to reach the backend. Resolution order (first wins):

1. **In-app override** — Profile → *Server* field (persisted on device).
2. **Build env** — `EXPO_PUBLIC_SERVER_URL` (set per profile in `eas.json`).
3. **App config** — `expo.extra.serverUrl` in `app.json`.
4. Dev default — `http://localhost:3001`.

> On a physical phone in Expo Go, `localhost` points at the phone, not your
> Mac. Use your machine's LAN IP (e.g. `http://192.168.1.20:3001`) or a tunnel.
> `wss://` is derived automatically from an `https://` server URL.

## Run in development

```bash
# 1. Start the backend (from the repo root)
cd .. && docker compose up -d db server

# 2. Start the app
cd mobile
npm install
npx expo start
```

Open in **Expo Go** (scan the QR) or a simulator (`i` / `a`). Set the server URL
to your machine's LAN IP under Profile → Server if you're on a real device.

> Node note: React Native 0.86 prefers Node 20/22/24. Node 23 works for Metro
> but may warn; EAS cloud builds use their own supported Node.

## Build for the stores (EAS)

One-time setup:

```bash
npm i -g eas-cli
eas login
eas init            # creates the EAS project, fills expo.extra.eas.projectId
```

Point `eas.json` (`preview` + `production` → `env.EXPO_PUBLIC_SERVER_URL`) at
your **public HTTPS** backend before building for anyone but yourself.

```bash
# Internal test builds (APK + ad-hoc/simulator)
eas build --profile preview --platform all

# Store-ready builds
eas build --profile production --platform ios       # → App Store Connect
eas build --profile production --platform android    # → Play Console (.aab)
```

## Submit

```bash
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

Fill in the real credentials in `eas.json` → `submit.production` first:

- **iOS**: `appleId`, `ascAppId` (App Store Connect app ID), `appleTeamId`.
  You also need an app record in App Store Connect and Apple Developer Program
  membership.
- **Android**: a Google Play service-account JSON (`play-service-account.json`,
  git-ignored) and an app in the Play Console. `track: internal` ships to the
  internal testing track first.

## Store checklist (before first submission)

- [ ] Replace placeholder bundle IDs `com.toepen.app` (iOS `bundleIdentifier` /
      Android `package`) with identifiers you own.
- [ ] Swap the placeholder icons/splash in `assets/` for real 1024×1024 art.
- [ ] Point the production server URL at a public HTTPS/WSS host with a valid
      TLS certificate (iOS ATS + Android cleartext rules require HTTPS).
- [ ] Set a strong `JWT_SECRET` on the server (`NODE_ENV=production` enforces it).
- [ ] Prepare store listings: screenshots, description, privacy policy URL
      (accounts collect a username + password hash).
- [ ] Bump `version` / `buildNumber` / `versionCode` per release (production
      profile auto-increments the build number remotely).

## Project layout

```
src/config.ts          server URL resolution (env / app config / in-app override)
src/theme.ts           brown-café palette ported from the web app
src/api/               REST clients: auth, games, users
src/auth/              AuthProvider, secure token storage, request middleware
src/net/useGameSocket  WebSocket protocol hook (mirrors the web client)
src/game/              per-code identity storage + useTable connection hook
src/components/        PlayingCard, Chat, Screen, shared UI
src/screens/           Login, Register, Home, Lobby, Game, Profile
src/navigation/        root/auth/tab navigators + typed params
```
