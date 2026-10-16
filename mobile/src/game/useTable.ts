import { useEffect, useState } from 'react';
import type { Identity } from '../types';
import { loadIdentity } from './identity';
import { useGameSocket, type SocketApi } from '../net/useGameSocket';

export interface TableConnection {
  identity: Identity | null;
  identityLoaded: boolean;
  socket: SocketApi;
}

// Loads the saved seat identity for a game code, then opens the live socket.
export function useTable(code: string): TableConnection {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    loadIdentity(code).then((id) => {
      if (!alive) return;
      setIdentity(id);
      setIdentityLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [code]);

  const socket = useGameSocket(identity ? code : null, identity?.playerId ?? null);

  return { identity, identityLoaded, socket };
}
