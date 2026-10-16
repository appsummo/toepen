# Toepen 🍺♠♥♣♦

An online, real-time version of the Dutch café card game **Toepen**. Create a
table, share the game code, and bluff your friends out of the round — with a
live chat (*Stamtafel*) tied to every game. Play from the **web app** or the
**native iOS/Android app** — everyone joins the same live game across devices.

Styled after a brown-café aesthetic (warm wood, parchment cards, green felt).

## Stack

| Service | Tech | Port |
|---------|------|------|
| `web`    | React + Vite + TypeScript, served by nginx | **8080** (the app) |
| `mobile` | React Native (Expo SDK 57) — iOS + Android | (see `mobile/`) |
| `server` | Node + TypeScript, Express (REST) + `ws` (WebSocket) | **3001** |
| `db`     | PostgreSQL 16 | **5432** |

The browser talks to a single origin (`:8080`); nginx proxies `/api` and `/ws`
to the backend. The mobile app talks to the same REST/WebSocket API at a
configurable server URL. Game state is authoritative on the server and persisted
to Postgres as a JSONB snapshot per game.

## Accounts

Players can register an account (username + password). Accounts add:

- **Saved stats & history** — games played/won, win rate, best placement, and a
  list of recent games (recorded when a game finishes).
- **Reconnect** — a logged-in player rejoining a table gets their existing seat
  back instead of a duplicate.

Auth is JWT-based (`server/src/auth`). Guests can still create/join games without
an account — accounts are optional on the web app and required by the mobile app.

> Set a strong `JWT_SECRET` on the server before exposing it publicly. In
> `NODE_ENV=production` the server refuses to start without one. `docker-compose`
> reads it from a `JWT_SECRET` env var (with a local-dev fallback).

## Mobile app

The native app lives in [`mobile/`](./mobile). It reuses this server and
protocol; point it at your backend's public URL and build with EAS for the App
Store and Play Store. See [`mobile/README.md`](./mobile/README.md) for dev,
build, and submission steps.

## Run it locally

```bash
docker compose up -d --build
```

Then open **http://localhost:8080**.

- **Create a table** → you get a *Spelcode* (e.g. `KLAVER-712`). Share it.
- Friends open the app, pick **Meedoen**, and enter the code — or just open the
  shared link `http://localhost:8080/game/<CODE>`.
- The host presses **Start het potje** once everyone's aboard (2–8 players).

Stop / reset:

```bash
docker compose down          # stop
docker compose down -v       # stop + wipe the database
```

### Ports

- App UI: `http://localhost:8080`
- API/WebSocket: `http://localhost:3001` (`/api`, `/ws`)
- Postgres: `localhost:5432` (user `toepen` / pass `toepen` / db `toepen`)

## Development (without Docker)

```bash
# 1. database
docker compose up -d db

# 2. backend  (http://localhost:3001)
cd server && npm install && npm run dev

# 3. frontend (http://localhost:5173, proxies to backend)
cd web && npm install && npm run dev
```

## Game rules implemented

Piquet deck (32 cards), rank low→high **J Q K A 7 8 9 10**, follow-suit trick
play, winner of the 4th trick wins the round. Plus:

- **Toep / Mee / Vouw** — knock to raise the stake; others call or fold.
  Escalating penalties (2, 3, …) with re-knocking, capped so no one is forced
  past the target on a single loss. You can't re-knock yourself twice in a row.
- **Scoring & elimination** — losers take penalty points; reaching the target
  (default 10) knocks you out. Last player standing wins.
- **Winning with a Jack** — win the final trick with a Boer and shed a point.
- **Four of a kind** — instant "Toep", everyone else takes 3.
- **Poverty** (*armoede*) — at the target-minus-one brink, others choose to
  play or fold after seeing their hand.
- **Dirty Laundry** (*vuile was*, toggleable) — swap a hand of four pictures
  (or three pictures + a 7) for four fresh cards.

## Tests

```bash
cd server && npm test        # game-engine unit tests (node:test)
```

## Layout

```
db/init.sql            schema (games, players, chat_messages)
server/src/engine/     pure, deterministic game engine (+ tests)
server/src/game/       room manager, per-player views, broadcast
server/src/           REST routes, WebSocket protocol, entrypoint
web/src/screens/       Landing, Lobby, GameRoom, GameTable
web/src/components/    PlayingCard, Chat
```
