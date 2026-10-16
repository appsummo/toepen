import type { Identity } from './types.js';

interface CreateResult {
  game: { id: string; code: string; status: string };
  player: { id: string; name: string; seat: number; isHost: boolean };
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Er ging iets mis');
  return data as T;
}

export async function createGame(opts: {
  name: string;
  targetPoints: number;
  thinkSeconds: number;
  dirtyLaundry: boolean;
}): Promise<CreateResult> {
  return post<CreateResult>('/api/games', opts);
}

export async function joinGame(code: string, name: string): Promise<CreateResult> {
  return post<CreateResult>(`/api/games/${encodeURIComponent(code)}/join`, { name });
}

export async function getGame(code: string): Promise<{
  id: string;
  code: string;
  status: string;
  targetPoints: number;
  playerCount: number;
}> {
  const res = await fetch(`/api/games/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error('Spel niet gevonden');
  return res.json();
}

// ---- local identity, scoped per game code ----

const key = (code: string) => `toepen:identity:${code.toUpperCase()}`;

export function saveIdentity(code: string, identity: Identity): void {
  localStorage.setItem(key(code), JSON.stringify(identity));
}

export function loadIdentity(code: string): Identity | null {
  const raw = localStorage.getItem(key(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Identity;
  } catch {
    return null;
  }
}

export function clearIdentity(code: string): void {
  localStorage.removeItem(key(code));
}
