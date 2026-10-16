import { Router, type Request, type Response } from 'express';
import * as users from '../db/users.js';
import * as repo from '../db/repo.js';
import { requireAuth } from '../auth/middleware.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get('/me/stats', async (req: Request, res: Response) => {
  const stats = await users.getUserStats(req.userId!);
  return res.json({ stats });
});

usersRouter.get('/me/history', async (req: Request, res: Response) => {
  const history = await users.getUserHistory(req.userId!);
  return res.json({ history });
});

// Games this account is seated in that are still joinable/live — powers "reconnect".
usersRouter.get('/me/games', async (req: Request, res: Response) => {
  const rows = await repo.listActiveGamesForUser(req.userId!);
  return res.json({ games: rows });
});
