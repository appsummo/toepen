import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as users from '../db/users.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { signToken } from '../auth/tokens.js';
import { requireAuth } from '../auth/middleware.js';

export const authRouter = Router();

const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Gebruikersnaam is te kort (min. 3 tekens)')
    .max(24, 'Gebruikersnaam is te lang (max. 24 tekens)')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Alleen letters, cijfers, _ . - toegestaan'),
  password: z.string().min(6, 'Wachtwoord is te kort (min. 6 tekens)').max(200),
});

const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1).max(24).optional(),
});

function publicUser(u: users.UserRow) {
  return { id: u.id, username: u.username, displayName: u.display_name };
}

authRouter.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Ongeldige invoer' });
  }
  const { username, password, displayName } = parsed.data;

  const existing = await users.getUserByUsername(username);
  if (existing) return res.status(409).json({ error: 'Gebruikersnaam is al bezet' });

  const passwordHash = await hashPassword(password);
  const user = await users.createUser({
    username,
    displayName: displayName?.trim() || username,
    passwordHash,
  });

  const token = signToken({ sub: user.id, username: user.username });
  return res.status(201).json({ token, user: publicUser(user) });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Ongeldige gebruikersnaam of wachtwoord' });
  }
  const { username, password } = parsed.data;

  const user = await users.getUserByUsername(username);
  if (!user) return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord' });

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Onjuiste gebruikersnaam of wachtwoord' });

  const token = signToken({ sub: user.id, username: user.username });
  return res.json({ token, user: publicUser(user) });
});

authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await users.getUserById(req.userId!);
  if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
  return res.json({ user: publicUser(user) });
});
