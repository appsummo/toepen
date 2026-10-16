import { query } from './pool.js';

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  created_at: string;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number; // 0..1
  bestPlacement: number | null;
  avgPlacement: number | null;
}

export interface GameHistoryEntry {
  gameId: string;
  isWinner: boolean;
  placement: number;
  finalPenalty: number;
  playersCount: number;
  finishedAt: string;
}

export async function createUser(opts: {
  username: string;
  displayName: string;
  passwordHash: string;
}): Promise<UserRow> {
  const res = await query<UserRow>(
    `INSERT INTO users (username, display_name, password_hash)
     VALUES ($1, $2, $3) RETURNING *`,
    [opts.username, opts.displayName, opts.passwordHash],
  );
  return res.rows[0];
}

export async function getUserByUsername(username: string): Promise<UserRow | null> {
  const res = await query<UserRow>('SELECT * FROM users WHERE lower(username) = lower($1)', [
    username,
  ]);
  return res.rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const res = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function recordResult(opts: {
  gameId: string;
  userId: string | null;
  playerId: string;
  displayName: string;
  isWinner: boolean;
  placement: number;
  finalPenalty: number;
  playersCount: number;
}): Promise<void> {
  await query(
    `INSERT INTO game_results
       (game_id, user_id, player_id, display_name, is_winner, placement, final_penalty, players_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (game_id, player_id) DO NOTHING`,
    [
      opts.gameId,
      opts.userId,
      opts.playerId,
      opts.displayName,
      opts.isWinner,
      opts.placement,
      opts.finalPenalty,
      opts.playersCount,
    ],
  );
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const res = await query<{
    games_played: string;
    games_won: string;
    best_placement: number | null;
    avg_placement: string | null;
  }>(
    `SELECT COUNT(*)::int AS games_played,
            COUNT(*) FILTER (WHERE is_winner)::int AS games_won,
            MIN(placement) AS best_placement,
            AVG(placement) AS avg_placement
       FROM game_results
      WHERE user_id = $1`,
    [userId],
  );
  const row = res.rows[0];
  const gamesPlayed = Number(row.games_played) || 0;
  const gamesWon = Number(row.games_won) || 0;
  return {
    gamesPlayed,
    gamesWon,
    winRate: gamesPlayed > 0 ? gamesWon / gamesPlayed : 0,
    bestPlacement: row.best_placement ?? null,
    avgPlacement: row.avg_placement != null ? Number(row.avg_placement) : null,
  };
}

export async function getUserHistory(userId: string, limit = 20): Promise<GameHistoryEntry[]> {
  const res = await query<{
    game_id: string;
    is_winner: boolean;
    placement: number;
    final_penalty: number;
    players_count: number;
    finished_at: string;
  }>(
    `SELECT game_id, is_winner, placement, final_penalty, players_count, finished_at
       FROM game_results
      WHERE user_id = $1
      ORDER BY finished_at DESC
      LIMIT $2`,
    [userId, limit],
  );
  return res.rows.map((r) => ({
    gameId: r.game_id,
    isWinner: r.is_winner,
    placement: r.placement,
    finalPenalty: r.final_penalty,
    playersCount: r.players_count,
    finishedAt: r.finished_at,
  }));
}
