import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card, ChatMessage, GameView, Outgoing } from '../types';
import { getWsUrl } from '../config';

export interface SocketApi {
  game: GameView | null;
  messages: ChatMessage[];
  connected: boolean;
  error: string | null;
  send: (msg: Outgoing) => void;
  clearError: () => void;
}

// Mirrors the web client's protocol: connect, auth with (gameId/code, playerId),
// then stream state/chat. Auto-reconnects with a short backoff.
export function useGameSocket(gameId: string | null, playerId: string | null): SocketApi {
  const [game, setGame] = useState<GameView | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!gameId || !playerId) return;
    let closed = false;

    const connect = () => {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'auth', gameId, playerId }));
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data));
          if (msg.type === 'state') setGame(msg.game);
          else if (msg.type === 'chatHistory') setMessages(msg.messages);
          else if (msg.type === 'chat') setMessages((prev) => [...prev, msg.message]);
          else if (msg.type === 'error') setError(msg.message);
        } catch {
          // ignore malformed frame
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!closed) retryRef.current = setTimeout(connect, 1200);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [gameId, playerId]);

  const send = useCallback((msg: Outgoing) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { game, messages, connected, error, send, clearError };
}

export type { Card };
