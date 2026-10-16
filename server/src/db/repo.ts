import { query } from './pool.js';
import type { EngineState } from '../engine/types.js';

export interface GameRow {
  id: string;
  code: string;
  status: string;
  target_points: number;
  think_seconds: number;
  dirty_laundry: boolean;
  host_player_id: string | null;
  state: EngineState | null;
  results_recorded: boolean;
  created_at: string;
}

// Atomically claim the "record results" job so a finished game is tallied once.
export async function claimResultsRecording(gameId: string): Promise<boolean> {
  const res = await query(
    `UPDATE games SET results_recorded = TRUE
      WHERE id = $1 AND results_recorded = FALSE`,
    [gameId],
  );
  return (res.rowCount ?? 0) > 0;
}

export interface PlayerRow {
  id: string;
  game_id: string;
  user_id: string | null;
  name: string;
  seat: number;
  is_host: boolean;
  ready: boolean;
  connected: boolean;
  created_at: string;
}

export interface ChatRow {
  id: string;
  game_id: string;
  player_id: string | null;
  name: string;
  body: string;
  kind: string;
  created_at: string;
}

const SUIT_WORDS = ['KLAVER', 'HARTEN', 'SCHOPPEN', 'RUITEN'];

function randomCode(): string {
  const word = SUIT_WORDS[Math.floor(Math.random() * SUIT_WORDS.length)];
  const num = 7 + Math.floor(Math.random() * 4); // 7..10, matches the deck
  return `${word}-${num}${Math.floor(Math.random() * 90 + 10)}`;
}

export async function createGame(opts: {
  targetPoints: number;
  thinkSeconds: number;
  dirtyLaundry: boolean;
}): Promise<GameRow> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    try {
      const res = await query<GameRow>(
        `INSERT INTO games (code, target_points, think_seconds, dirty_laundry)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [code, opts.targetPoints, opts.thinkSeconds, opts.dirtyLaundry],
      );
      return res.rows[0];
    } catch (err) {
      if (attempt === 9) throw err; // give up after repeated code collisions
    }
  }
  throw new Error('could not allocate game code');
}

export async function getGameByCode(code: string): Promise<GameRow | null> {
  const res = await query<GameRow>('SELECT * FROM games WHERE code = $1', [code.toUpperCase()]);
  return res.rows[0] ?? null;
}

export async function getGameById(id: string): Promise<GameRow | null> {
  const res = await query<GameRow>('SELECT * FROM games WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function listGamePlayers(gameId: string): Promise<PlayerRow[]> {
  const res = await query<PlayerRow>(
    'SELECT * FROM players WHERE game_id = $1 ORDER BY seat',
    [gameId],
  );
  return res.rows;
}

export async function addPlayer(opts: {
  gameId: string;
  name: string;
  seat: number;
  isHost: boolean;
  userId?: string | null;
}): Promise<PlayerRow> {
  const res = await query<PlayerRow>(
    `INSERT INTO players (game_id, name, seat, is_host, ready, user_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [opts.gameId, opts.name, opts.seat, opts.isHost, opts.isHost, opts.userId ?? null],
  );
  return res.rows[0];
}

// A player this account already holds in a game — the basis for reconnecting.
export async function findPlayerByUser(
  gameId: string,
  userId: string,
): Promise<PlayerRow | null> {
  const res = await query<PlayerRow>(
    'SELECT * FROM players WHERE game_id = $1 AND user_id = $2 LIMIT 1',
    [gameId, userId],
  );
  return res.rows[0] ?? null;
}

export interface ActiveGameSummary {
  id: string;
  code: string;
  status: string;
  seat: number;
  player_id: string;
  player_count: number;
  updated_at: string;
}

export async function listActiveGamesForUser(userId: string): Promise<ActiveGameSummary[]> {
  const res = await query<ActiveGameSummary>(
    `SELECT g.id, g.code, g.status, p.seat, p.id AS player_id, g.updated_at,
            (SELECT COUNT(*)::int FROM players pp WHERE pp.game_id = g.id) AS player_count
       FROM players p
       JOIN games g ON g.id = p.game_id
      WHERE p.user_id = $1 AND g.status <> 'finished'
      ORDER BY g.updated_at DESC`,
    [userId],
  );
  return res.rows;
}

export async function setHost(gameId: string, playerId: string): Promise<void> {
  await query('UPDATE games SET host_player_id = $1, updated_at = now() WHERE id = $2', [
    playerId,
    gameId,
  ]);
}

export async function getPlayer(id: string): Promise<PlayerRow | null> {
  const res = await query<PlayerRow>('SELECT * FROM players WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function setReady(playerId: string, ready: boolean): Promise<void> {
  await query('UPDATE players SET ready = $1 WHERE id = $2', [ready, playerId]);
}

export async function setConnected(playerId: string, connected: boolean): Promise<void> {
  await query('UPDATE players SET connected = $1 WHERE id = $2', [connected, playerId]);
}

export async function saveState(
  gameId: string,
  status: string,
  state: EngineState | null,
): Promise<void> {
  await query(
    'UPDATE games SET status = $1, state = $2, updated_at = now() WHERE id = $3',
    [status, state ? JSON.stringify(state) : null, gameId],
  );
}

export async function updateSettings(
  gameId: string,
  opts: { targetPoints: number; thinkSeconds: number; dirtyLaundry: boolean },
): Promise<void> {
  await query(
    `UPDATE games SET target_points = $1, think_seconds = $2, dirty_laundry = $3, updated_at = now()
     WHERE id = $4`,
    [opts.targetPoints, opts.thinkSeconds, opts.dirtyLaundry, gameId],
  );
}

export async function addChat(opts: {
  gameId: string;
  playerId: string | null;
  name: string;
  body: string;
  kind?: string;
}): Promise<ChatRow> {
  const res = await query<ChatRow>(
    `INSERT INTO chat_messages (game_id, player_id, name, body, kind)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [opts.gameId, opts.playerId, opts.name, opts.body, opts.kind ?? 'chat'],
  );
  return res.rows[0];
}

export async function listChat(gameId: string, limit = 100): Promise<ChatRow[]> {
  const res = await query<ChatRow>(
    'SELECT * FROM chat_messages WHERE game_id = $1 ORDER BY created_at DESC LIMIT $2',
    [gameId, limit],
  );
  return res.rows.reverse();
}
