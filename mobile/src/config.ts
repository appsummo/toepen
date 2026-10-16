import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base URL of the Toepen backend (no trailing slash), e.g. https://toepen.example
// Resolution order: in-app override (AsyncStorage) → app config `extra.serverUrl`
// → build-time env → localhost dev default. Hosting can be chosen later without
// touching code: set it in app.json `extra`, or let the user override in-app.
const CONFIGURED =
  (Constants.expoConfig?.extra?.serverUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_SERVER_URL ??
  'http://localhost:3001';

const STORAGE_KEY = 'toepen:serverUrl';

let current = CONFIGURED;

export function getServerUrl(): string {
  return current.replace(/\/+$/, '');
}

export function getApiUrl(): string {
  return `${getServerUrl()}/api`;
}

export function getWsUrl(): string {
  const base = getServerUrl();
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/ws`;
}

export async function loadServerUrl(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) current = stored;
  } catch {
    // ignore — fall back to the configured default
  }
}

export async function setServerUrl(url: string): Promise<void> {
  current = url.trim().replace(/\/+$/, '');
  await AsyncStorage.setItem(STORAGE_KEY, current);
}

export function isDefaultServerUrl(): boolean {
  return getServerUrl() === CONFIGURED.replace(/\/+$/, '');
}
