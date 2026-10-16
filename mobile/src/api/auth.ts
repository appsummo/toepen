import { request } from './client';
import type { AuthUser } from '../types';

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function register(opts: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', { method: 'POST', body: opts });
}

export async function login(opts: {
  username: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', { method: 'POST', body: opts });
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await request<{ user: AuthUser }>('/auth/me');
  return res.user;
}
