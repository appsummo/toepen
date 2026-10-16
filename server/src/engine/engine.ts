import {
  type Card,
  cardId,
  freshDeck,
  isPicture,
  makeRng,
  rankStrength,
  shuffle,
} from './cards.js';
import type { EnginePlayer, EngineState, RoundLogEntry } from './types.js';

export interface SeatInit {
  id: string;
  seat: number;
  name: string;
  penalty: number;
  eliminated: boolean;
}

export interface EngineOptions {
  targetPoints: number;
  dirtyLaundryEnabled: boolean;
}

const clone = <T>(v: T): T => structuredClone(v);

function log(state: EngineState, entry: RoundLogEntry): void {
  state.log.push(entry);
}

// ---- seat helpers -------------------------------------------------------

function playerAt(state: EngineState, seat: number): EnginePlayer {
  const p = state.players.find((pl) => pl.seat === seat);
  if (!p) throw new Error(`no player at seat ${seat}`);
  return p;
}

/** Seats of players still contesting the round (dealt in, not folded, not eliminated). */
export function inRoundSeats(state: EngineState): number[] {
  return state.players
    .filter((p) => p.inRound && !p.eliminated)
    .map((p) => p.seat)
    .sort((a, b) => a - b);
}

/** Seats of players active in the game (not eliminated). */
function activeSeats(state: EngineState): number[] {
  return state.players
    .filter((p) => !p.eliminated)
    .map((p) => p.seat)
    .sort((a, b) => a - b);
}

/** Next seat clockwise from `from` among players still in the round. */
function nextInRound(state: EngineState, from: number): number {
  const seats = state.players.map((p) => p.seat).sort((a, b) => a - b);
  const n = seats.length;
  const idx = seats.indexOf(from);
  for (let step = 1; step <= n; step++) {
    const seat = seats[(idx + step) % n];
    const p = playerAt(state, seat);
    if (p.inRound && !p.eliminated) return seat;
  }
  return from;
}

/** Next active (non-eliminated) seat clockwise. Used for choosing the dealer/leader. */
function nextActive(state: EngineState, from: number): number {
  const seats = state.players.map((p) => p.seat).sort((a, b) => a - b);
  const n = seats.length;
  const idx = seats.indexOf(from);
  for (let step = 1; step <= n; step++) {
    const seat = seats[(idx + step) % n];
    if (!playerAt(state, seat).eliminated) return seat;
  }
  return from;
}

/**
 * Withdraw a player's cards from the trick in progress. A player who folds is
 * out of the round, so their card must leave the table: otherwise it could win
 * the trick (and the round) for them, and it would be counted against the
 * shrunken contender list when deciding whether the trick is complete.
 */
function withdrawFromTrick(state: EngineState, seat: number): void {
  if (state.currentTrick.length === 0) return;
  state.currentTrick = state.currentTrick.filter((pc) => pc.seat !== seat);
  // The first remaining card defines the lead; an emptied trick is re-led.
  state.leadSuit = state.currentTrick[0]?.card.suit ?? null;
}

// ---- construction -------------------------------------------------------

export function createEngine(seats: SeatInit[], opts: EngineOptions): EngineState {
  const players: EnginePlayer[] = seats
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map((s) => ({
      id: s.id,
      seat: s.seat,
      name: s.name,
      hand: [],
      penalty: s.penalty,
      eliminated: s.eliminated,
      inRound: false,
      folded: false,
      foldPenalty: 0,
      usedChance: false,
      played: [],
    }));

  return {
    phase: 'round_over',
    targetPoints: opts.targetPoints,
    dirtyLaundryEnabled: opts.dirtyLaundryEnabled,
    round: 0,
    dealerSeat: players[0].seat,
    turnSeat: players[0].seat,
    leadSuit: null,
    currentTrick: [],
    trickNumber: 0,
    lastTrickWinnerSeat: null,
    stake: 1,
    lastKnockerSeat: null,
    pendingKnock: null,
    players,
    povertyDecisions: {},
    log: [],
    winnerSeat: null,
    gameWinnerSeat: null,
  };
}

// ---- dealing ------------------------------------------------------------

function countByRank(hand: Card[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of hand) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

/** Deal a new round. dealerSeat is expected to already be set (winner deals). */
export function startRound(prev: EngineState, seed: number): EngineState {
  const state = clone(prev);
  const rng = makeRng(seed);

  state.round += 1;
  state.log = [];
  state.currentTrick = [];
  state.leadSuit = null;
  state.trickNumber = 0;
  state.lastTrickWinnerSeat = null;
  state.stake = 1;
  state.lastKnockerSeat = null;
  state.pendingKnock = null;
  state.povertyDecisions = {};
  state.winnerSeat = null;

  // Reset per-round player flags; eliminated players sit out.
  for (const p of state.players) {
    p.hand = [];
    p.folded = false;
    p.foldPenalty = 0;
    p.usedChance = false;
    p.played = [];
    p.inRound = !p.eliminated;
  }

  const active = activeSeats(state);
  const deck = shuffle(freshDeck(), rng);
  // Deal 4 cards each, one at a time, clockwise starting left of dealer.
  let di = 0;
  const startSeat = nextActive(state, state.dealerSeat);
  for (let round = 0; round < 4; round++) {
    let seat = startSeat;
    for (let i = 0; i < active.length; i++) {
      playerAt(state, seat).hand.push(deck[di++]);
      seat = nextActive(state, seat);
    }
  }

  log(state, { kind: 'deal', text: `Ronde ${state.round} gedeeld.` });

  // Instant win: four of a kind ("Toep").
  for (const seat of active) {
    const p = playerAt(state, seat);
    const counts = countByRank(p.hand);
    for (const [, c] of counts) {
      if (c === 4) {
        log(state, { kind: 'toep', seat, text: `${p.name} roept Toep — vier gelijke!` });
        return finishRound(state, seat, null, { fourOfAKind: true });
      }
    }
  }

  // Poverty: any in-game player at target-1 triggers a play/fold decision phase.
  const povertyExists = state.players.some(
    (p) => !p.eliminated && p.penalty >= state.targetPoints - 1,
  );
  state.turnSeat = startSeat;
  if (povertyExists) {
    state.phase = 'poverty';
    log(state, { kind: 'poverty', text: 'Armoede! Beslis of je meespeelt.' });
  } else {
    state.phase = 'playing';
  }
  return state;
}

// ---- poverty decisions --------------------------------------------------

export function povertyDecide(
  prev: EngineState,
  seat: number,
  decision: 'play' | 'fold',
): EngineState {
  if (prev.phase !== 'poverty') throw new Error('not in poverty phase');
  const state = clone(prev);
  const p = playerAt(state, seat);
  if (!p.inRound) throw new Error('player not in round');

  // Players already in poverty must play; only others decide.
  const inPoverty = p.penalty >= state.targetPoints - 1;
  if (inPoverty) throw new Error('poverty player must play');

  state.povertyDecisions[seat] = decision;
  if (decision === 'fold') {
    p.inRound = false;
    p.folded = true;
    p.foldPenalty = 1;
    withdrawFromTrick(state, seat);
    log(state, { kind: 'poverty_fold', seat, text: `${p.name} vouwt bij armoede.` });
  } else {
    log(state, { kind: 'poverty_play', seat, text: `${p.name} speelt mee.` });
  }

  // Once every non-poverty player has decided, begin play.
  const undecided = state.players.filter(
    (pl) =>
      !pl.eliminated &&
      pl.inRound &&
      pl.penalty < state.targetPoints - 1 &&
      state.povertyDecisions[pl.seat] === undefined,
  );
  if (undecided.length === 0) {
    const remaining = inRoundSeats(state);
    if (remaining.length === 1) {
      return finishRound(state, remaining[0], null, {});
    }
    state.phase = 'playing';
    state.turnSeat = nextActive(state, state.dealerSeat);
    // Ensure leader is someone still in the round.
    if (!playerAt(state, state.turnSeat).inRound) {
      state.turnSeat = nextInRound(state, state.turnSeat);
    }
  }
  return state;
}

// ---- legal moves --------------------------------------------------------

export function legalCards(state: EngineState, seat: number): Card[] {
  const p = playerAt(state, seat);
  if (state.leadSuit === null) return p.hand.slice();
  const following = p.hand.filter((c) => c.suit === state.leadSuit);
  return following.length > 0 ? following : p.hand.slice();
}

export function canKnock(state: EngineState, seat: number): boolean {
  if (state.phase !== 'playing') return false;
  if (state.turnSeat !== seat) return false;
  const p = playerAt(state, seat);
  if (!p.inRound || p.eliminated) return false;
  if (state.lastKnockerSeat === seat) return false; // no re-knocking yourself
  if (inRoundSeats(state).length < 2) return false;
  // Cap: knocking allowed only while no in-round player would exceed target on loss.
  const newStake = state.stake + 1;
  const wouldBust = inRoundSeats(state).some(
    (s) => playerAt(state, s).penalty + newStake > state.targetPoints,
  );
  return !wouldBust;
}

// ---- playing a card -----------------------------------------------------

export function playCard(prev: EngineState, seat: number, card: Card): EngineState {
  if (prev.phase !== 'playing') throw new Error('not in playing phase');
  if (prev.turnSeat !== seat) throw new Error('not your turn');
  const state = clone(prev);
  const p = playerAt(state, seat);
  if (!p.inRound) throw new Error('player not in round');

  const legal = legalCards(state, seat);
  if (!legal.some((c) => cardId(c) === cardId(card))) {
    throw new Error('illegal card (must follow suit)');
  }

  // Remove exactly one matching card from hand.
  const idx = p.hand.findIndex((c) => cardId(c) === cardId(card));
  p.hand.splice(idx, 1);

  if (state.currentTrick.length === 0) state.leadSuit = card.suit;
  state.currentTrick.push({ seat, card });
  p.played.push({ card, trick: state.trickNumber });
  log(state, { kind: 'play', seat, text: `${p.name} speelt ${cardId(card)}.` });

  const contenders = inRoundSeats(state);
  if (state.currentTrick.length >= contenders.length) {
    return resolveTrick(state);
  }
  state.turnSeat = nextInRound(state, seat);
  return state;
}

function resolveTrick(state: EngineState): EngineState {
  // Every card still on the table belongs to a contender (folders' cards are
  // withdrawn as they fold), and the first of them defines the lead suit — which
  // may have shifted from state.leadSuit if the original leader folded.
  const lead = state.currentTrick[0]?.card.suit ?? state.leadSuit!;
  // Winner = highest card of the lead suit (no trumps in Toepen).
  const followers = state.currentTrick.filter((pc) => pc.card.suit === lead);
  const best = followers.reduce((a, b) =>
    rankStrength(b.card.rank) > rankStrength(a.card.rank) ? b : a,
  );
  const winnerSeat = best.seat;
  const winnerCard = best.card;

  state.lastTrickWinnerSeat = winnerSeat;
  log(state, {
    kind: 'trick',
    seat: winnerSeat,
    text: `${playerAt(state, winnerSeat).name} wint slag ${state.trickNumber + 1}.`,
  });

  const isFinalTrick = state.trickNumber >= 3;
  if (isFinalTrick) {
    return finishRound(state, winnerSeat, winnerCard, {});
  }

  // Prepare next trick; winner leads (or next in-round seat if winner has folded).
  state.trickNumber += 1;
  state.currentTrick = [];
  state.leadSuit = null;
  const leader = playerAt(state, winnerSeat).inRound
    ? winnerSeat
    : nextInRound(state, winnerSeat);
  state.turnSeat = leader;
  return state;
}

// ---- knocking (toep) ----------------------------------------------------

export function knock(prev: EngineState, seat: number): EngineState {
  if (!canKnock(prev, seat)) throw new Error('cannot knock now');
  const state = clone(prev);
  const p = playerAt(state, seat);
  const newStake = state.stake + 1;
  const responses: Record<number, 'call' | 'fold' | null> = {};
  for (const s of inRoundSeats(state)) {
    if (s !== seat) responses[s] = null; // asked, not yet decided
  }
  state.pendingKnock = { knockerSeat: seat, newStake, responses };
  state.phase = 'knock';
  log(state, {
    kind: 'knock',
    seat,
    text: `${p.name} heeft getoept — inzet naar ${newStake}.`,
  });
  // If knocker is the only one in the round, resolve immediately.
  return maybeResolveKnock(state);
}

export function respondKnock(
  prev: EngineState,
  seat: number,
  response: 'call' | 'fold',
): EngineState {
  if (prev.phase !== 'knock' || !prev.pendingKnock) throw new Error('no pending knock');
  const state = clone(prev);
  const pk = state.pendingKnock!;
  if (!(seat in pk.responses)) throw new Error('you are not asked to respond');
  if (pk.responses[seat] != null) throw new Error('already responded');

  const p = playerAt(state, seat);
  pk.responses[seat] = response;
  if (response === 'fold') {
    p.inRound = false;
    p.folded = true;
    p.foldPenalty = state.stake; // locked in at the pre-knock level
    withdrawFromTrick(state, seat);
    log(state, { kind: 'fold', seat, text: `${p.name} vouwt.` });
  } else {
    log(state, { kind: 'call', seat, text: `${p.name} gaat mee.` });
  }
  return maybeResolveKnock(state);
}

function maybeResolveKnock(state: EngineState): EngineState {
  const pk = state.pendingKnock!;
  const pending = Object.entries(pk.responses).filter(([, v]) => v == null);
  if (pending.length > 0) return state; // still waiting on someone

  // All responses in. Apply new stake to remaining players.
  state.stake = pk.newStake;
  state.lastKnockerSeat = pk.knockerSeat;
  state.pendingKnock = null;

  const remaining = inRoundSeats(state);
  if (remaining.length === 1) {
    // Everyone else folded; the last player standing wins the round.
    return finishRound(state, remaining[0], null, {});
  }

  // Resume play. The knocker still owes their card if the trick was mid-turn.
  state.phase = 'playing';
  if (!playerAt(state, state.turnSeat).inRound) {
    state.turnSeat = nextInRound(state, state.turnSeat);
  }
  return state;
}

// ---- dirty laundry ------------------------------------------------------

/** Declare Dirty Laundry: swap the whole hand for four fresh cards. */
export function dirtyLaundry(prev: EngineState, seat: number, seed: number): EngineState {
  if (!prev.dirtyLaundryEnabled) throw new Error('dirty laundry disabled');
  if (prev.phase !== 'playing') throw new Error('not in playing phase');
  if (prev.turnSeat !== seat) throw new Error('not your turn');
  const state = clone(prev);
  const p = playerAt(state, seat);
  if (p.hand.length !== 4) throw new Error('can only declare with a full hand');

  // Rebuild the remaining deck: full deck minus everyone's hands and played cards.
  const used = new Set<string>();
  for (const pl of state.players) for (const c of pl.hand) used.add(cardId(c));
  for (const pc of state.currentTrick) used.add(cardId(pc.card));
  const remainingDeck = shuffle(
    freshDeck().filter((c) => !used.has(cardId(c))),
    makeRng(seed),
  );
  p.hand = remainingDeck.slice(0, 4);
  log(state, { kind: 'dirty_laundry', seat, text: `${p.name} gooit de vuile was — nieuwe hand.` });
  return state;
}

export function hasDirtyLaundry(hand: Card[]): boolean {
  const pictures = hand.filter(isPicture).length;
  const sevens = hand.filter((c) => c.rank === '7').length;
  return pictures === 4 || (pictures === 3 && sevens === 1);
}

// ---- round resolution ---------------------------------------------------

interface FinishOpts {
  fourOfAKind?: boolean;
}

function finishRound(
  state: EngineState,
  winnerSeat: number,
  winnerCard: Card | null,
  opts: FinishOpts,
): EngineState {
  state.phase = 'round_over';
  state.winnerSeat = winnerSeat;
  const winner = playerAt(state, winnerSeat);

  if (opts.fourOfAKind) {
    // Instant win: all other in-game players take 3 points.
    for (const p of state.players) {
      if (p.seat !== winnerSeat && !p.eliminated) p.penalty += 3;
    }
    log(state, { kind: 'result', seat: winnerSeat, text: `${winner.name} wint direct met vier gelijke (+3 voor de rest).` });
  } else {
    // Callers who stayed in and lost pay the stake.
    for (const p of state.players) {
      if (p.eliminated) continue;
      if (p.seat === winnerSeat) continue;
      if (p.folded) {
        p.penalty += p.foldPenalty;
      } else if (p.inRound) {
        p.penalty += state.stake;
      }
    }
    // Jack bonus: winning the final trick with a Jack removes one point.
    if (winnerCard && winnerCard.rank === 'J') {
      winner.penalty = Math.max(0, winner.penalty - 1);
      log(state, { kind: 'jack', seat: winnerSeat, text: `${winner.name} wint met een Boer — 1 punt eraf!` });
    }
    log(state, { kind: 'result', seat: winnerSeat, text: `${winner.name} wint de ronde.` });
  }

  // Eliminations.
  for (const p of state.players) {
    if (!p.eliminated && p.penalty >= state.targetPoints) {
      p.eliminated = true;
      p.inRound = false;
      log(state, { kind: 'eliminated', seat: p.seat, text: `${p.name} ligt eruit (${p.penalty} punten).` });
    }
  }

  const survivors = state.players.filter((p) => !p.eliminated);
  if (survivors.length <= 1) {
    state.phase = 'game_over';
    state.gameWinnerSeat = survivors.length === 1 ? survivors[0].seat : winnerSeat;
    log(state, { kind: 'game_over', seat: state.gameWinnerSeat!, text: `${playerAt(state, state.gameWinnerSeat!).name} wint het spel!` });
  } else {
    // Winner deals the next round.
    state.dealerSeat = winner.eliminated ? nextActive(state, winnerSeat) : winnerSeat;
  }

  state.currentTrick = state.currentTrick.slice(); // keep table visible until next deal
  return state;
}
