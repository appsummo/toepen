import { request } from './client';

export interface CreateResult {
  game: { id: string; code: string; status: string };
  player: { id: string; name: string; seat: number; isHost: boolean };
  reconnected?: boolean;
}

export async function createGame(opts: {
  name: string;
  targetPoints: number;
  thinkSeconds: number;
  dirtyLaundry: boolean;
}): Promise<CreateResult> {
  return request<CreateResult>('/games', { method: 'POST', body: opts });
}

export async function joinGame(code: string, name: string): Promise<CreateResult> {
  return request<CreateResult>(`/games/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: { name },
  });
}

export interface GameInfo {
  id: string;
  code: string;
  status: string;
  targetPoints: number;
  playerCount: number;
}

export async function getGame(code: string): Promise<GameInfo> {
  return request<GameInfo>(`/games/${encodeURIComponent(code)}`);
}
