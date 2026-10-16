import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';
import * as repo from './db/repo.js';
import * as mgr from './game/manager.js';

interface AuthedSocket extends WebSocket {
  gameId?: string;
  conn?: ReturnType<typeof mgr.register>;
}

// Authenticate a socket against a (gameId/code, playerId) pair.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authenticate(
  gameRef: string,
  playerId: string,
): Promise<{ gameId: string } | null> {
  if (!UUID_RE.test(playerId)) return null;
  const player = await repo.getPlayer(playerId);
  if (!player) return null;
  // gameRef may be a UUID or a friendly code; pick the matching lookup.
  const game = UUID_RE.test(gameRef)
    ? await repo.getGameById(gameRef)
    : await repo.getGameByCode(gameRef);
  if (!game || player.game_id !== game.id) return null;
  return { gameId: game.id };
}

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: AuthedSocket) => {
    ws.on('message', async (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return mgr.sendError(ws, 'Ongeldig bericht');
      }

      try {
        // First message must be auth.
        if (msg.type === 'auth') {
          const auth = await authenticate(String(msg.gameId), String(msg.playerId));
          if (!auth) return mgr.sendError(ws, 'Authenticatie mislukt');
          ws.gameId = auth.gameId;
          ws.conn = mgr.register(auth.gameId, String(msg.playerId), ws);
          await repo.setConnected(String(msg.playerId), true);
          await mgr.sendChatHistory(ws.conn, auth.gameId);
          await mgr.broadcast(auth.gameId);
          return;
        }

        if (!ws.gameId || !ws.conn) return mgr.sendError(ws, 'Nog niet geauthenticeerd');
        const gameId = ws.gameId;
        const playerId = ws.conn.playerId;

        switch (msg.type) {
          case 'chat':
            return void (await mgr.handleChat(gameId, playerId, String(msg.body)));
          case 'ready':
            return void (await mgr.handleReady(gameId, playerId, Boolean(msg.ready)));
          case 'settings':
            return void (await mgr.handleSettings(gameId, playerId, {
              targetPoints: Number(msg.targetPoints),
              thinkSeconds: Number(msg.thinkSeconds),
              dirtyLaundry: Boolean(msg.dirtyLaundry),
            }));
          case 'start':
            return void (await mgr.handleStart(gameId, playerId));
          case 'play':
            return void (await mgr.handlePlay(gameId, playerId, msg.card as never));
          case 'knock':
            return void (await mgr.handleKnock(gameId, playerId));
          case 'respond':
            return void (await mgr.handleRespond(
              gameId,
              playerId,
              msg.response === 'fold' ? 'fold' : 'call',
            ));
          case 'poverty':
            return void (await mgr.handlePoverty(
              gameId,
              playerId,
              msg.decision === 'fold' ? 'fold' : 'play',
            ));
          case 'declareWas':
            return void (await mgr.handleDeclareWas(gameId, playerId, Boolean(msg.declare)));
          case 'challengeWas':
            return void (await mgr.handleChallengeWas(
              gameId,
              playerId,
              msg.target === null || msg.target === undefined ? null : Number(msg.target),
            ));
          case 'nextRound':
            return void (await mgr.handleNextRound(gameId, playerId));
          default:
            return mgr.sendError(ws, `Onbekend berichttype: ${msg.type}`);
        }
      } catch (err) {
        return mgr.sendError(ws, err instanceof Error ? err.message : 'Er ging iets mis');
      }
    });

    ws.on('close', async () => {
      if (ws.gameId && ws.conn) {
        mgr.unregister(ws.gameId, ws.conn);
        await repo.setConnected(ws.conn.playerId, false).catch(() => undefined);
        await mgr.broadcast(ws.gameId).catch(() => undefined);
      }
    });
  });
}
