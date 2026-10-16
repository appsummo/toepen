import { request } from './client';
import type { UserStats, GameHistoryEntry, ActiveGame } from '../types';

export async function fetchStats(): Promise<UserStats> {
  const res = await request<{ stats: UserStats }>('/users/me/stats');
  return res.stats;
}

export async function fetchHistory(): Promise<GameHistoryEntry[]> {
  const res = await request<{ history: GameHistoryEntry[] }>('/users/me/history');
  return res.history;
}

export async function fetchActiveGames(): Promise<ActiveGame[]> {
  const res = await request<{ games: ActiveGame[] }>('/users/me/games');
  return res.games;
}
