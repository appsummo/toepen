-- Toepen schema. Runs once on first container start.
-- The server also runs idempotent migrations at startup (see src/db/migrate.ts),
-- so an existing database gets the accounts tables without a manual step.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username       TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username));

CREATE TABLE IF NOT EXISTS games (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT UNIQUE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'lobby',   -- lobby | playing | finished
  target_points  INTEGER NOT NULL DEFAULT 15,
  think_seconds  INTEGER NOT NULL DEFAULT 30,
  dirty_laundry  BOOLEAN NOT NULL DEFAULT TRUE,
  host_player_id UUID,
  state          JSONB,                           -- authoritative round/engine snapshot
  results_recorded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  seat            INTEGER NOT NULL,
  is_host         BOOLEAN NOT NULL DEFAULT FALSE,
  ready           BOOLEAN NOT NULL DEFAULT FALSE,
  penalty_points  INTEGER NOT NULL DEFAULT 0,
  eliminated      BOOLEAN NOT NULL DEFAULT FALSE,
  connected       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, seat)
);
CREATE INDEX IF NOT EXISTS idx_players_user ON players(user_id);

CREATE TABLE IF NOT EXISTS game_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  player_id     UUID,
  display_name  TEXT NOT NULL,
  is_winner     BOOLEAN NOT NULL DEFAULT FALSE,
  placement     INTEGER NOT NULL,
  final_penalty INTEGER NOT NULL,
  players_count INTEGER NOT NULL,
  finished_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_results_user ON game_results(user_id, finished_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id     UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id   UUID REFERENCES players(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  body        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'chat',       -- chat | system
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_chat_game ON chat_messages(game_id, created_at);
