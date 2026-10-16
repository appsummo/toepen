import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Identity } from '../types';

// Persist the seat identity per game code so the device can reconnect to a
// live table without re-joining (the WebSocket authenticates with playerId).
const key = (code: string) => `toepen:identity:${code.toUpperCase()}`;

export async function saveIdentity(code: string, identity: Identity): Promise<void> {
  await AsyncStorage.setItem(key(code), JSON.stringify(identity));
}

export async function loadIdentity(code: string): Promise<Identity | null> {
  const raw = await AsyncStorage.getItem(key(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Identity;
  } catch {
    return null;
  }
}

export async function clearIdentity(code: string): Promise<void> {
  await AsyncStorage.removeItem(key(code));
}
