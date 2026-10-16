import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './tokens.js';

// Augment Express Request with the authenticated user id.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

/** Populates req.userId when a valid token is present; never rejects. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = bearer(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.userId = payload.sub;
  }
  next();
}

/** Rejects the request with 401 when no valid token is present. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = bearer(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: 'Niet ingelogd' });
    return;
  }
  req.userId = payload.sub;
  next();
}
