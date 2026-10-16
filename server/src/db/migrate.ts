import { query } from './pool.js';

// Idempotent schema migrations. Safe to run on every startup: covers both a
// fresh database (where db/init.sql already ran) and an existing one created
// before accounts existed. All statements use IF NOT EXISTS / additive DDL.
const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     username      TEXT NOT NULL,
     display_name  TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  // Case-insensitive uniqueness on username without requiring the citext extension.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (lower(username))`,

  // Link a seated player to an account (guests keep user_id NULL).
  `ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_players_user ON players(user_id)`,

  // One row per player per finished game — the basis for account stats/history.
  `CREATE TABLE IF NOT EXISTS game_results (
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
   )`,
  `CREATE INDEX IF NOT EXISTS idx_results_user ON game_results(user_id, finished_at)`,

  // Default target moved from 10 to 15. Only affects rows inserted without an
  // explicit value - every existing game keeps the target it was created with.
  `ALTER TABLE games ALTER COLUMN target_points SET DEFAULT 15`,

  // Guard against double-recording a finished game.
  `ALTER TABLE games ADD COLUMN IF NOT EXISTS results_recorded BOOLEAN NOT NULL DEFAULT FALSE`,
];

export async function migrate(): Promise<void> {
  for (const sql of STATEMENTS) {
    await query(sql);
  }
}
