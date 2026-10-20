# Toepen 🍺 ♠♥♣♦

An online, real-time version of **Toepen**, the Dutch café card game. Open a
table, share the code, and bluff your friends out of the round — with a live
chat (*Stamtafel*) at every table.

Four cards each. Whoever takes the **last** trick wins the round. Everyone else
picks up penalty points, and the first to the target is out. At any point you
can *toep* — knock — and raise what the round is worth, which is where the game
really lives: a bad hand played confidently beats a good hand played timidly.

- **No account, no install.** Open the page, pick a name, play.
- **Dutch or English**, chosen per player — two people at one table can read it
  in different languages at the same time.
- **Plays on a phone**, same page, no app.
- **2–8 players**, state is authoritative on the server, so a refresh or a lost
  connection drops you back into the same seat.

Styled after a brown café: warm wood, parchment cards, green felt.

---

## Quick start

With Docker, one command:

```bash
docker compose up -d --build
```

Open **http://localhost:8080** and you have a table.

To play a real game you need a second player — open the same address in another
browser (or another device on your network) and join with the code. Within one
browser, use a private window: players are told apart by `localStorage`, so two
normal tabs share a seat.

```bash
docker compose down          # stop
docker compose down -v       # stop and wipe the database
```

### How a game goes

1. **Potje aanmaken / Start a game** → you get a code like `KLAVER-712`.
2. Share the code, or the link `http://localhost:8080/game/KLAVER-712`.
3. Others pick **Meedoen / Join a game** and type the code.
4. The host presses **Start** once everyone is seated (2–8 players).

The rules are in the app itself, in both languages, at `/regels` (or `/rules`).

---

## Running it without Docker

Handy when you are working on the code — both dev servers reload on save.

You need **Node 20+** and a **PostgreSQL 16** you can reach. The database is the
only part worth running in Docker:

```bash
docker compose up -d db
```

Then, in two terminals:

```bash
# backend — http://localhost:3001
cd server
npm install
DATABASE_URL="postgres://toepen:toepen@localhost:5432/toepen" \
JWT_SECRET="local-dev-secret" \
npm run dev
```

```bash
# frontend — http://localhost:5173, proxies /api and /ws to the backend
cd web
npm install
npm run dev
```

Open **http://localhost:5173**. The schema is applied automatically on boot
(`server/src/db/migrate.ts`), so there is no migration step to remember.

Already have Postgres locally? Point `DATABASE_URL` at it instead — any
database the user can create tables in will do.

### Ports

| | |
|---|---|
| App (Docker) | `http://localhost:8080` |
| App (Vite dev server) | `http://localhost:5173` |
| API + WebSocket | `http://localhost:3001` — `/api`, `/ws` |
| Postgres | `localhost:5432` — user `toepen`, password `toepen`, db `toepen` |

Those database credentials are local-development defaults and live in
`docker-compose.yml`. Nothing in this repository is meant to be exposed to the
internet as-is.

---

## Tests

```bash
cd server && npm test        # game engine + per-player views (node:test)
```

The engine is pure and deterministic — it takes a state and a seed and returns
a new state — so the rules are testable without a database, a socket or a
clock. That is where the interesting tests are: knock escalation and its cap,
fold penalties, poverty, the decider round, and that a player only ever sees
their own hand.

Typecheck either half with `npx tsc --noEmit` in `server/` or `web/`.

---

## How it fits together

```
browser ──HTTP /api──┐
                     ├──► server (Express + ws) ──► Postgres
browser ──WS /ws─────┘        │
                              └── engine: pure functions, no I/O
```

The server is authoritative. A client sends an *intention* ("play this card"),
never a result; the engine validates it, produces the next state, and that
state is saved to Postgres as a JSONB snapshot and broadcast to everyone — each
player receiving a view with only their own cards in it.

**The server never sends a finished sentence.** Round-log lines travel as
`{kind, params}` and errors as codes, so each browser renders them in its own
language. Dutch is the source of truth (`web/src/i18n/nl.ts`) and `en.ts` is
typed against it, so a missing translation is a compile error rather than a
Dutch sentence appearing in an English game. Adding a language is a third file
and an entry in `LANGS`.

### Layout

```
db/init.sql            schema: games, players, chat_messages
server/src/engine/     the rules: pure, deterministic, tested
server/src/game/       room manager, per-player views, broadcast
server/src/            REST routes, WebSocket protocol, entrypoint
web/src/screens/       Landing, Lobby, GameRoom, GameTable, Rules
web/src/i18n/          nl.ts (source of truth), en.ts, provider
web/src/content/       the rules text, per language
deploy/                nginx and Caddy templates for self-hosting
```

---

## The rules, as implemented

Piquet deck (32 cards: 7 through 10, J, Q, K, A), ranking low→high
**J Q K A 7 8 9 10**, follow suit if you can, and the winner of the **final**
trick wins the round. On top of that:

- **Toep / Mee / Vouw** — knock to raise the stake; the others call or fold.
  Folding costs the stake from before the knock. Anyone may knock again, but
  never twice in a row themselves, and knocking stops once a loss would push a
  player who is still in past the target.
- **Scoring** — losers take penalty points; reaching the target (15 by default,
  the host can pick 5/8/10/12/15) puts you out. Last player standing wins.
- **Winning with a Jack** — take the last trick with the weakest card in the
  game and a point comes *off* your score.
- **Four of a kind** — instant Toep: you win the round, everyone else takes 3.
- **Poverty** (*armoede*) — when somebody is one point from the target, the
  others look at their cards and choose to play along or fold.
- **Dirty laundry** (*vuile was*, host can switch it off) — claim a hand of
  nothing but pictures (or all but one plus a 7) and swap it. You may bluff,
  and anyone may quietly check you; nobody sees who checked.
- **Time to think** — every table has a clock. When it runs out the server
  plays the safest legal move for you: weakest card, or fold.

"Chance for Toep" — swapping a card when you hold three of a kind — is **not**
implemented, which is why it is absent from the in-app rules too.

### Accounts

The REST and WebSocket APIs support accounts (JWT, `server/src/auth`), but the
web app has **no login screen yet** — everyone plays as a guest. Guests can
create and join tables freely.

---

## Self-hosting

`docker-compose.prod.yml` builds the same stack for a server: no default
credentials, Postgres not published, the web container bound to loopback, and
the server behind either the host's own nginx (`deploy/nginx-site.conf`) or
Caddy (`--profile caddy`, which gets a certificate by itself). Copy
`.env.example` to `.env` and generate every value — the server refuses to start
in production without a `JWT_SECRET`.

Run it behind TLS, keep `.env` out of git, and set `TRUST_PROXY_HOPS` to the
number of proxies in front of the server so rate limiting sees real client IPs.

---

## Contributing

Issues and pull requests are welcome. Two things worth knowing before you
start:

- **Keep the engine pure.** `server/src/engine/` must not touch the database,
  the network or the clock. It takes state in and gives state back. Everything
  that needs randomness takes a seed.
- **No player-facing sentences on the server.** Add a `kind` and some `params`,
  then the wording in `web/src/i18n/nl.ts` and `en.ts`. The compiler will tell
  you if you forgot one.

Run `cd server && npm test` and `npx tsc --noEmit` in both halves before
opening a PR.

## Licence

MIT — see [LICENSE](./LICENSE).
