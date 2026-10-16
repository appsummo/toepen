import type { EngineState } from '../engine/types.js';
import { canKnock, legalCards } from '../engine/engine.js';
import { hasDirtyLaundry } from '../engine/engine.js';
import type { GameRow, PlayerRow } from '../db/repo.js';

// A sanitized snapshot sent to one viewer: only their own hand is revealed.
export function buildView(
  game: GameRow,
  players: PlayerRow[],
  state: EngineState | null,
  viewerId: string | null,
) {
  const base = {
    id: game.id,
    code: game.code,
    status: game.status,
    targetPoints: game.target_points,
    thinkSeconds: game.think_seconds,
    dirtyLaundry: game.dirty_laundry,
    hostPlayerId: game.host_player_id,
    viewerId,
  };

  if (!state || game.status === 'lobby') {
    return {
      ...base,
      phase: 'lobby' as const,
      round: 0,
      players: players.map((p) => ({
        id: p.id,
        seat: p.seat,
        name: p.name,
        isHost: p.is_host,
        ready: p.ready,
        connected: p.connected,
        penalty: 0,
        eliminated: false,
        inRound: false,
        folded: false,
        handCount: 0,
        isYou: p.id === viewerId,
      })),
    };
  }

  const meta = new Map(players.map((p) => [p.id, p]));
  const viewPlayers = state.players.map((ep) => {
    const m = meta.get(ep.id);
    const isYou = ep.id === viewerId;
    return {
      id: ep.id,
      seat: ep.seat,
      name: ep.name,
      isHost: m?.is_host ?? false,
      ready: m?.ready ?? false,
      connected: m?.connected ?? true,
      penalty: ep.penalty,
      eliminated: ep.eliminated,
      inRound: ep.inRound,
      folded: ep.folded,
      handCount: ep.hand.length,
      played: ep.played ?? [], // games dealt before piles existed have none
      hand: isYou ? ep.hand : undefined,
      isYou,
    };
  });

  const me = viewerId ? state.players.find((p) => p.id === viewerId) : undefined;
  const isMyTurn = me ? state.turnSeat === me.seat : false;

  const you = me
    ? {
        seat: me.seat,
        hand: me.hand,
        inRound: me.inRound,
        folded: me.folded,
        eliminated: me.eliminated,
        isMyTurn,
        legalCards: isMyTurn && state.phase === 'playing' ? legalCards(state, me.seat) : [],
        canKnock: canKnock(state, me.seat),
        canPlay: isMyTurn && state.phase === 'playing',
        canDirtyLaundry:
          isMyTurn &&
          state.phase === 'playing' &&
          state.dirtyLaundryEnabled &&
          me.hand.length === 4 &&
          hasDirtyLaundry(me.hand),
        mustRespondKnock:
          state.phase === 'knock' &&
          !!state.pendingKnock &&
          me.seat in state.pendingKnock.responses &&
          state.pendingKnock.responses[me.seat] == null,
        mustDecidePoverty:
          state.phase === 'poverty' &&
          me.inRound &&
          me.penalty < state.targetPoints - 1 &&
          state.povertyDecisions[me.seat] === undefined,
      }
    : null;

  return {
    ...base,
    phase: state.phase,
    round: state.round,
    dealerSeat: state.dealerSeat,
    turnSeat: state.turnSeat,
    leadSuit: state.leadSuit,
    currentTrick: state.currentTrick,
    trickNumber: state.trickNumber,
    stake: state.stake,
    lastKnockerSeat: state.lastKnockerSeat,
    pendingKnock: state.pendingKnock,
    winnerSeat: state.winnerSeat,
    gameWinnerSeat: state.gameWinnerSeat,
    log: state.log.slice(-30),
    players: viewPlayers,
    you,
  };
}

export type GameView = ReturnType<typeof buildView>;
