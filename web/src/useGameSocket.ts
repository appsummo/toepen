import { useCallback, useEffect, useRef, useState } from 'react';
import type { Card, ChatMessage, GameView } from './types.js';

type Outgoing =
  | { type: 'chat'; body: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'settings'; targetPoints: number; thinkSeconds: number; dirtyLaundry: boolean }
  | { type: 'start' }
  | { type: 'play'; card: Card }
  | { type: 'knock' }
  | { type: 'respond'; response: 'call' | 'fold' }
  | { type: 'poverty'; decision: 'play' | 'fold' }
  | { type: 'declareWas'; declare: boolean }
  | { type: 'challengeWas'; target: number | null }
  | { type: 'nextRound' };

/** A server-side refusal: a code to translate, plus the raw fallback. */
export interface SocketError {
  code?: string;
  message: string;
}

export interface SocketApi {
  game: GameView | null;
  messages: ChatMessage[];
  connected: boolean;
  error: SocketError | null;
  send: (msg: Outgoing) => void;
  clearError: () => void;
}

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

export function useGameSocket(gameId: string | null, playerId: string | null): SocketApi {
  const [game, setGame] = useState<GameView | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<SocketError | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!gameId || !playerId) return;
    let closed = false;

    const connect = () => {
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'auth', gameId, playerId }));
      };

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'state') setGame(msg.game);
        else if (msg.type === 'chatHistory') setMessages(msg.messages);
        else if (msg.type === 'chat') setMessages((prev) => [...prev, msg.message]);
        else if (msg.type === 'error') setError({ code: msg.code, message: msg.message });
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
