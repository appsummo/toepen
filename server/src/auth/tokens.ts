import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? '';
if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}
// Dev fallback keeps local runs frictionless; production is guarded above.
const EFFECTIVE_SECRET = SECRET || 'toepen-dev-secret-change-me';

const EXPIRES_IN = '30d';

export interface TokenPayload {
  sub: string; // user id
  username: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, EFFECTIVE_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, EFFECTIVE_SECRET);
    if (typeof decoded === 'string') return null;
    const { sub, username } = decoded as jwt.JwtPayload;
    if (typeof sub !== 'string' || typeof username !== 'string') return null;
    return { sub, username };
  } catch {
    return null;
  }
}
