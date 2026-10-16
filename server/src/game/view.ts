import type { EngineState } from '../engine/types.js';
import { canKnock, legalCards, claimantSeats } from '../engine/engine.js';
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
        // Anyone may claim vuile was, true or not - the bluff is the point, so
        // this is never gated on actually holding the hand.
        mustDeclareWas: state.phase === 'declare' && state.declareDecisions[me.seat] === null,
        mustChallengeWas:
          state.phase === 'challenge' &&
          me.seat in state.challengeDecisions &&
          state.challengeDecisions[me.seat] === null,
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
    handSize: state.handSize ?? 4, // rounds dealt before deciders existed
    dealerSeat: state.dealerSeat,
    turnSeat: state.turnSeat,
    leadSuit: state.leadSuit,
    currentTrick: state.currentTrick,
    trickNumber: state.trickNumber,
    stake: state.stake,
    lastKnockerSeat: state.lastKnockerSeat,
    pendingKnock: state.pendingKnock,
    // The clock is the server's. `now` ships with every snapshot so a client
    // whose own clock is wrong can measure the offset instead of counting down
    // from a deadline it would otherwise misread.
    // Who claimed is public - a claim is shouted. Who is *checking* is not, and
    // challengeDecisions never leaves the server while the window is open: that
    // is what lets several players quietly decide to check at once.
    wasClaimants: claimantSeats(state),
    wasResults:
      state.phase === 'declare' || state.phase === 'challenge'
        ? []
        : state.claims
            .filter((c) => c.outcome && c.outcome !== 'unchallenged')
            .map((c) => ({ seat: c.seat, outcome: c.outcome, revealed: c.revealed })),
    turnDeadline: state.turnDeadline ?? null,
    now: Date.now(),
    winnerSeat: state.winnerSeat,
    gameWinnerSeat: state.gameWinnerSeat,
    log: state.log.slice(-30),
    players: viewPlayers,
    you,
  };
}

export type GameView = ReturnType<typeof buildView>;
