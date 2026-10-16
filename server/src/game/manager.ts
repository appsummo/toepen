import type { WebSocket } from 'ws';
import * as repo from '../db/repo.js';
import {
  createEngine,
  startRound,
  playCard,
  knock,
  respondKnock,
  povertyDecide,
  declareWas,
  challengeWas,
  applyTurnTimeout,
  awaitingAction,
} from '../engine/engine.js';
import type { Card } from '../engine/cards.js';
import type { EngineState } from '../engine/types.js';
import * as users from '../db/users.js';
import { buildView } from './view.js';

interface Conn {
  ws: WebSocket;
  playerId: string;
}

const rooms = new Map<string, Set<Conn>>();
const locks = new Map<string, Promise<unknown>>();
// One pending turn-timer per game. The clock lives on the server: a client
// countdown is only a display of the deadline it was handed.
const timers = new Map<string, NodeJS.Timeout>();

function seed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

// Serialize mutations per game so concurrent actions can't corrupt state.
async function withLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(gameId) ?? Promise.resolve();
  let release: () => void;
  const next = new Promise<void>((r) => (release = r));
  locks.set(gameId, prev.then(() => next));
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release!();
  }
}

export function register(gameId: string, playerId: string, ws: WebSocket): Conn {
  const conn: Conn = { ws, playerId };
  if (!rooms.has(gameId)) rooms.set(gameId, new Set());
  rooms.get(gameId)!.add(conn);
  // A redeploy drops every in-memory timer. The first player back at the table
  // rearms it from the stored deadline, so a restart cannot strand a game.
  if (!timers.has(gameId)) void scheduleTimer(gameId);
  return conn;
}

export function unregister(gameId: string, conn: Conn): void {
  const conns = rooms.get(gameId);
  conns?.delete(conn);
  // With the table empty there is nobody to be kept waiting, so stop the clock
  // rather than playing the round out to an audience of nobody.
  if (conns && conns.size === 0) clearTimer(gameId);
}

function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

export function sendError(ws: WebSocket, message: string): void {
  send(ws, { type: 'error', message });
}

export async function broadcast(gameId: string): Promise<void> {
  const game = await repo.getGameById(gameId);
  if (!game) return;
  const players = await repo.listGamePlayers(gameId);
  const conns = rooms.get(gameId);
  if (!conns) return;
  for (const conn of conns) {
    const view = buildView(game, players, game.state, conn.playerId);
    send(conn.ws, { type: 'state', game: view });
  }
}

export async function sendState(conn: Conn, gameId: string): Promise<void> {
  const game = await repo.getGameById(gameId);
  if (!game) return;
  const players = await repo.listGamePlayers(gameId);
  send(conn.ws, {
    type: 'state',
    game: buildView(game, players, game.state, conn.playerId),
  });
}

export async function sendChatHistory(conn: Conn, gameId: string): Promise<void> {
  const messages = await repo.listChat(gameId);
  send(conn.ws, { type: 'chatHistory', messages });
}

function broadcastRaw(gameId: string, payload: unknown): void {
  const conns = rooms.get(gameId);
  if (!conns) return;
  for (const conn of conns) send(conn.ws, payload);
}

// ---- turn clock ---------------------------------------------------------

/**
 * Stamp the state with the moment the players now on the clock run out of time.
 * Any action restarts the clock, so whoever is waited on next always gets the
 * full think time rather than the remains of someone else's.
 */
function withDeadline(state: EngineState, thinkSeconds: number): EngineState {
  return {
    ...state,
    turnDeadline: awaitingAction(state) ? Date.now() + thinkSeconds * 1000 : null,
  };
}

function clearTimer(gameId: string): void {
  const timer = timers.get(gameId);
  if (timer) clearTimeout(timer);
  timers.delete(gameId);
}

/**
 * Arm the timer for whatever the persisted state says is due. Because the
 * deadline is stored with the state rather than held only in memory, a server
 * restart does not hand everyone unlimited time: rescheduling after a redeploy
 * picks the deadline back up, and one already in the past fires at once.
 */
async function scheduleTimer(gameId: string): Promise<void> {
  clearTimer(gameId);
  const game = await repo.getGameById(gameId);
  const deadline = game?.state?.turnDeadline;
  if (!game || !deadline || !game.state || !awaitingAction(game.state)) return;
  const delay = Math.max(0, deadline - Date.now());
  timers.set(
    gameId,
    setTimeout(() => void onTimeout(gameId), delay + 50),
  );
}

async function onTimeout(gameId: string): Promise<void> {
  timers.delete(gameId);
  try {
    await mutateEngine(gameId, (state) => applyTurnTimeout(state, seed()));
  } catch (err) {
    // Leave the clock stopped rather than retrying into a hot loop; the next
    // player action reschedules it.
    console.error(`[toepen] turn timeout failed for game ${gameId}`, err);
  }
}

// ---- action handlers ----------------------------------------------------

export async function handleChat(
  gameId: string,
  playerId: string,
  body: string,
): Promise<void> {
  const text = String(body ?? '').trim().slice(0, 500);
  if (!text) return;
  const player = await repo.getPlayer(playerId);
  if (!player || player.game_id !== gameId) return;
  const msg = await repo.addChat({ gameId, playerId, name: player.name, body: text });
  broadcastRaw(gameId, { type: 'chat', message: msg });
}

async function systemChat(gameId: string, body: string): Promise<void> {
  const msg = await repo.addChat({ gameId, playerId: null, name: 'Tafel', body, kind: 'system' });
  broadcastRaw(gameId, { type: 'chat', message: msg });
}

export async function handleReady(
  gameId: string,
  playerId: string,
  ready: boolean,
): Promise<void> {
  await repo.setReady(playerId, !!ready);
  await broadcast(gameId);
}

export async function handleSettings(
  gameId: string,
  playerId: string,
  opts: { targetPoints: number; thinkSeconds: number; dirtyLaundry: boolean },
): Promise<void> {
  const game = await repo.getGameById(gameId);
  if (!game || game.host_player_id !== playerId || game.status !== 'lobby') return;
  await repo.updateSettings(gameId, {
    targetPoints: Math.max(2, Math.min(20, opts.targetPoints | 0)),
    thinkSeconds: Math.max(10, Math.min(120, opts.thinkSeconds | 0)),
    dirtyLaundry: !!opts.dirtyLaundry,
  });
  await broadcast(gameId);
}

export async function handleStart(gameId: string, playerId: string): Promise<void> {
  await withLock(gameId, async () => {
    const game = await repo.getGameById(gameId);
    if (!game || game.status !== 'lobby') throw new Error('game already started');
    if (game.host_player_id !== playerId) throw new Error('only the host can start');
    const players = await repo.listGamePlayers(gameId);
    if (players.length < 2) throw new Error('need at least 2 players');

    let engine = createEngine(
      players.map((p) => ({
        id: p.id,
        seat: p.seat,
        name: p.name,
        penalty: 0,
        eliminated: false,
      })),
      { targetPoints: game.target_points, dirtyLaundryEnabled: game.dirty_laundry },
    );
    // Random first dealer.
    engine.dealerSeat = players[Math.floor(Math.random() * players.length)].seat;
    engine = withDeadline(startRound(engine, seed()), game.think_seconds);
    await repo.saveState(gameId, 'playing', engine);
  });
  await systemChat(gameId, 'Het potje is begonnen! 🍺');
  await scheduleTimer(gameId);
  await broadcast(gameId);
}

async function mutateEngine(
  gameId: string,
  fn: (state: NonNullable<repo.GameRow['state']>) => NonNullable<repo.GameRow['state']>,
): Promise<void> {
  let finishedState: EngineState | null = null;
  await withLock(gameId, async () => {
    const game = await repo.getGameById(gameId);
    if (!game || !game.state) throw new Error('game not in progress');
    const next = withDeadline(fn(game.state), game.think_seconds);
    const status = next.phase === 'game_over' ? 'finished' : 'playing';
    await repo.saveState(gameId, status, next);
    if (status === 'finished') finishedState = next;
  });
  if (finishedState) await recordResults(gameId, finishedState);
  await scheduleTimer(gameId);
  await broadcast(gameId);
}

// Persist one game_result row per seated player so account stats accrue.
// Placement: overall winner first, then remaining players by fewest penalties.
async function recordResults(gameId: string, state: EngineState): Promise<void> {
  const claimed = await repo.claimResultsRecording(gameId);
  if (!claimed) return; // already tallied by a concurrent action

  const players = await repo.listGamePlayers(gameId);
  const bySeat = new Map(players.map((p) => [p.seat, p]));
  const winnerSeat = state.gameWinnerSeat;

  const ranked = [...state.players].sort((a, b) => {
    if (a.seat === winnerSeat) return -1;
    if (b.seat === winnerSeat) return 1;
    return a.penalty - b.penalty;
  });

  for (let i = 0; i < ranked.length; i++) {
    const ep = ranked[i];
    const row = bySeat.get(ep.seat);
    if (!row) continue;
    await users.recordResult({
      gameId,
      userId: row.user_id,
      playerId: row.id,
      displayName: ep.name,
      isWinner: ep.seat === winnerSeat,
      placement: i + 1,
      finalPenalty: ep.penalty,
      playersCount: ranked.length,
    });
  }
}

function seatOf(state: NonNullable<repo.GameRow['state']>, playerId: string): number {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) throw new Error('not a player in this game');
  return p.seat;
}

export async function handlePlay(
  gameId: string,
  playerId: string,
  card: Card,
): Promise<void> {
  await mutateEngine(gameId, (state) => playCard(state, seatOf(state, playerId), card));
}

export async function handleKnock(gameId: string, playerId: string): Promise<void> {
  await mutateEngine(gameId, (state) => knock(state, seatOf(state, playerId)));
}

export async function handleRespond(
  gameId: string,
  playerId: string,
  response: 'call' | 'fold',
): Promise<void> {
  await mutateEngine(gameId, (state) =>
    respondKnock(state, seatOf(state, playerId), response),
  );
}

export async function handlePoverty(
  gameId: string,
  playerId: string,
  decision: 'play' | 'fold',
): Promise<void> {
  await mutateEngine(gameId, (state) =>
    povertyDecide(state, seatOf(state, playerId), decision),
  );
}

export async function handleDeclareWas(
  gameId: string,
  playerId: string,
  declare: boolean,
): Promise<void> {
  await mutateEngine(gameId, (state) =>
    declareWas(state, seatOf(state, playerId), declare, seed()),
  );
}

export async function handleChallengeWas(
  gameId: string,
  playerId: string,
  target: number | null,
): Promise<void> {
  await mutateEngine(gameId, (state) =>
    challengeWas(state, seatOf(state, playerId), target, seed()),
  );
}

export async function handleNextRound(gameId: string, playerId: string): Promise<void> {
  await withLock(gameId, async () => {
    const game = await repo.getGameById(gameId);
    if (!game || !game.state) throw new Error('game not in progress');
    if (game.state.phase !== 'round_over') throw new Error('round not finished');
    // The dealer (round winner) starts the next deal; anyone at the table may trigger it.
    const next = withDeadline(startRound(game.state, seed()), game.think_seconds);
    await repo.saveState(gameId, 'playing', next);
  });
  await scheduleTimer(gameId);
  await broadcast(gameId);
}
