import { Router, type Request, type Response } from 'express';
import * as repo from './db/repo.js';
import { optionalAuth } from './auth/middleware.js';
import { createGameLimiter } from './security.js';

export const router = Router();

const MAX_PLAYERS = 8;

function cleanName(raw: unknown): string {
  return String(raw ?? '').trim().slice(0, 24);
}

// Create a new game + host player. Associates the account when logged in.
router.post('/games', createGameLimiter, optionalAuth, async (req: Request, res: Response) => {
  const name = cleanName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Naam is verplicht' });

  const targetPoints = Math.max(2, Math.min(20, Number(req.body?.targetPoints) || 15));
  const thinkSeconds = Math.max(10, Math.min(120, Number(req.body?.thinkSeconds) || 30));
  const dirtyLaundry = req.body?.dirtyLaundry !== false;

  const game = await repo.createGame({ targetPoints, thinkSeconds, dirtyLaundry });
  const player = await repo.addPlayer({
    gameId: game.id,
    name,
    seat: 0,
    isHost: true,
    userId: req.userId ?? null,
  });
  await repo.setHost(game.id, player.id);

  return res.status(201).json({
    game: { id: game.id, code: game.code, status: game.status },
    player: { id: player.id, name: player.name, seat: player.seat, isHost: true },
  });
});

// Join an existing game by code. A logged-in account that is already seated
// gets its existing player back (reconnect) instead of a duplicate seat.
router.post('/games/:code/join', optionalAuth, async (req: Request, res: Response) => {
  const name = cleanName(req.body?.name);
  const game = await repo.getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: 'Spel niet gevonden' });

  if (req.userId) {
    const existing = await repo.findPlayerByUser(game.id, req.userId);
    if (existing) {
      return res.status(200).json({
        game: { id: game.id, code: game.code, status: game.status },
        player: {
          id: existing.id,
          name: existing.name,
          seat: existing.seat,
          isHost: existing.is_host,
        },
        reconnected: true,
      });
    }
  }

  if (!name) return res.status(400).json({ error: 'Naam is verplicht' });
  if (game.status !== 'lobby') return res.status(409).json({ error: 'Het potje is al begonnen' });

  const players = await repo.listGamePlayers(game.id);
  if (players.length >= MAX_PLAYERS) return res.status(409).json({ error: 'De tafel is vol' });

  const takenSeats = new Set(players.map((p) => p.seat));
  let seat = 0;
  while (takenSeats.has(seat)) seat++;

  const player = await repo.addPlayer({
    gameId: game.id,
    name,
    seat,
    isHost: false,
    userId: req.userId ?? null,
  });
  return res.status(201).json({
    game: { id: game.id, code: game.code, status: game.status },
    player: { id: player.id, name: player.name, seat: player.seat, isHost: false },
  });
});

// Public game info (used to validate a code before connecting).
router.get('/games/:code', async (req: Request, res: Response) => {
  const game = await repo.getGameByCode(req.params.code);
  if (!game) return res.status(404).json({ error: 'Spel niet gevonden' });
  const players = await repo.listGamePlayers(game.id);
  return res.json({
    id: game.id,
    code: game.code,
    status: game.status,
    targetPoints: game.target_points,
    playerCount: players.length,
  });
});

router.get('/health', async (_req, res) => res.json({ ok: true }));
