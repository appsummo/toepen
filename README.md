# Toepen 🍺♠♥♣♦

An online, real-time version of the Dutch café card game **Toepen**. Create a
table, share the game code, and bluff your friends out of the round — with a
live chat (*Stamtafel*) tied to every game. It is a web app, and the same page
plays on a phone — everyone joins the same live game across devices.

The interface is available in **Dutch and English**; players pick their own
language and sit at the same table, each reading it in theirs.

Styled after a brown-café aesthetic (warm wood, parchment cards, green felt).

## Stack

| Service | Tech | Port |
|---------|------|------|
| `web`    | React + Vite + TypeScript, served by nginx | **8080** (the app) |
| `server` | Node + TypeScript, Express (REST) + `ws` (WebSocket) | **3001** |
| `db`     | PostgreSQL 16 | **5432** |

The browser talks to a single origin (`:8080`); nginx proxies `/api` and `/ws`
to the backend. Game state is authoritative on the server and persisted to
Postgres as a JSONB snapshot per game.

The server never sends a finished sentence to a client. Round-log lines travel
as `{kind, params}` and errors as codes, so each browser renders them in its own
language (`web/src/i18n`). Dutch is the source of truth: `en.ts` is typed
against it, so a missing translation is a compile error.

## Accounts

Players can register an account (username + password). Accounts add:

- **Saved stats & history** — games played/won, win rate, best placement, and a
  list of recent games (recorded when a game finishes).
- **Reconnect** — a logged-in player rejoining a table gets their existing seat
  back instead of a duplicate.

Auth is JWT-based (`server/src/auth`). The REST and WebSocket APIs support
accounts, but **the web app has no login screen yet** — in the browser everyone
plays as a guest, and guests can create and join games freely.

> Set a strong `JWT_SECRET` on the server before exposing it publicly. In
> `NODE_ENV=production` the server refuses to start without one. `docker-compose`
> reads it from a `JWT_SECRET` env var (with a local-dev fallback).

## On a phone

There is no app to install: the web app is the mobile app. Below 900px the chat
moves out of the layout into a drawer, below 640px the cards and table chrome
shrink to fit, and the layout keeps clear of a notch or home indicator. A
previous React Native client was removed in favour of this.

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

## Deploy to a server

> Already deployed at **https://toepen.appninja.info**. For the live setup —
> updating it, rolling back, backups, TLS and troubleshooting — see the runbook
> in [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md). The rest of this section
> describes the two shapes in general.

`docker-compose.prod.yml` covers two shapes. Unlike `docker-compose.yml` (local
development, HTTP, default passwords) it has **no default credentials** and does
not publish Postgres. Every value comes from `.env`.

### A. The host already serves something else

This is the common case — a VPS that is already running a site. The stack binds
only to loopback and the host's own nginx proxies to it, so nothing competes for
ports 80/443 and the existing sites are untouched.

```
host nginx :443  →  127.0.0.1:8080 (web)  →  server :3001  →  db :5432
```

Install the two nginx pieces, which are additive and change no existing site:

```bash
scp deploy/nginx-map-upgrade.conf root@HOST:/etc/nginx/conf.d/map-upgrade.conf
scp deploy/nginx-site.conf root@HOST:/etc/nginx/sites-available/toepen
ssh root@HOST 'sed -i s/TOEPEN_DOMAIN/your.domain/ /etc/nginx/sites-available/toepen \
  && ln -sf /etc/nginx/sites-available/toepen /etc/nginx/sites-enabled/toepen \
  && nginx -t && systemctl reload nginx \
  && certbot --nginx -d your.domain'
```

Then start the stack (no `--profile`, so Caddy never runs):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### B. A dedicated box with ports 80 and 443 free

Caddy fronts the stack and obtains and renews a Let's Encrypt certificate on its
own, giving `https://` and `wss://` with no manual certificate work.

```
caddy :80/:443  →  web (nginx :80)  →  server :3001  →  db :5432
```

Set `DOMAIN`, `ACME_EMAIL` and `TRUST_PROXY_HOPS=2` in `.env`, then:

```bash
docker compose -f docker-compose.prod.yml --profile caddy up -d --build
```

Point an `A` record at the host and open 80/443 first — Caddy cannot complete
the ACME challenge until the domain resolves here.

### Configuration

**Point DNS at the host** (both shapes): an `A` record for your domain aimed at
the server's public IP.

**Configure secrets** on the server:

```bash
cp .env.example .env
openssl rand -base64 24   # → POSTGRES_PASSWORD
openssl rand -hex 32      # → JWT_SECRET
$EDITOR .env              # also set DOMAIN and ACME_EMAIL
```

Generate these **on the server**; never commit `.env` (it is git-ignored).
`JWT_SECRET` signs login tokens — anyone who learns it can forge any account,
and changing it later logs everyone out. The server refuses to start in
production without it.

The schema is created on first start by `db/init.sql`, and
`server/src/db/migrate.ts` runs idempotent migrations on every boot, so deploys
need no manual database step.

**Update to a new version:**

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

Players are disconnected only briefly: the server finishes in-flight requests on
`SIGTERM`, game state lives in Postgres, and the clients reconnect on their own.

**Back up the database** — it holds the accounts and game history:

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > toepen-$(date +%F).sql.gz
```

### What is hardened

- TLS with automatic renewal (Caddy in shape B, certbot in shape A); HSTS,
  `nosniff` and referrer policy headers.
- Rate limits: 300 req/min across the API, 20 failed logins per 15 min, 30 new
  tables per 10 min. The server trusts exactly `TRUST_PROXY_HOPS` proxies so
  limits key on the real client IP.
- CORS is same-origin by default; add extra origins to `CORS_ORIGINS` only if
  something outside the site needs the API.
- Postgres is not reachable from outside the compose network, the web container
  binds to loopback only, and the server container runs as a non-root user.
- Images build from committed lockfiles (`npm ci`), so a rebuild ships exactly
  the versions that were tested.

## Game rules implemented

The same rules are in the app itself, in both languages, at `/regels` (or
`/rules`) — written against what the engine actually does rather than the café
variant, so "Chance for Toep" is deliberately absent.

Piquet deck (32 cards), rank low→high **J Q K A 7 8 9 10**, follow-suit trick
play, winner of the 4th trick wins the round. Plus:

- **Toep / Mee / Vouw** — knock to raise the stake; others call or fold.
  Escalating penalties (2, 3, …) with re-knocking, capped so no one is forced
  past the target on a single loss. You can't re-knock yourself twice in a row.
- **Scoring & elimination** — losers take penalty points; reaching the target
  (default 15) knocks you out. Last player standing wins.
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
docs/DEPLOYMENT.md     runbook for the live deployment
deploy/                nginx + Caddy config for production
db/init.sql            schema (games, players, chat_messages)
server/src/engine/     pure, deterministic game engine (+ tests)
server/src/game/       room manager, per-player views, broadcast
server/src/           REST routes, WebSocket protocol, entrypoint
web/src/screens/       Landing, Lobby, GameRoom, GameTable
web/src/components/    PlayingCard, Chat
```
