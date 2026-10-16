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
    claims: [],
    declareDecisions: {},
    challengeDecisions: {},
    log: [],
    turnDeadline: null,
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
  state.claims = [];
  state.declareDecisions = {};
  state.challengeDecisions = {};
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

  // With vuile was in play, everyone gets a window to claim a weak hand before
  // a card is led. Bluffing is allowed, so the window is open to everybody.
  if (state.dirtyLaundryEnabled) {
    state.phase = 'declare';
    for (const seat of active) state.declareDecisions[seat] = null;
    log(state, { kind: 'declare', text: 'Vuile was? Gooi je hand weg of pas.' });
    return state;
  }
  return beginPlay(state);
}

/** Open the round proper: poverty decisions first if anyone is on the brink. */
function beginPlay(state: EngineState): EngineState {
  const povertyExists = state.players.some(
    (p) => !p.eliminated && p.penalty >= state.targetPoints - 1,
  );
  state.turnSeat = nextActive(state, state.dealerSeat);
  if (!playerAt(state, state.turnSeat).inRound) {
    state.turnSeat = nextInRound(state, state.turnSeat);
  }
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

// ---- vuile was: claim, peek, resolve ------------------------------------

/** A hand weak enough to throw away: four pictures, or three and a seven. */
export function hasDirtyLaundry(hand: Card[]): boolean {
  const pictures = hand.filter(isPicture).length;
  const sevens = hand.filter((c) => c.rank === '7').length;
  return pictures === 4 || (pictures === 3 && sevens === 1);
}

/** Deal a fresh hand from what is left of the deck. */
function swapHand(state: EngineState, seat: number, seed: number): void {
  const used = new Set<string>();
  for (const pl of state.players) for (const c of pl.hand) used.add(cardId(c));
  for (const pc of state.currentTrick) used.add(cardId(pc.card));
  const remaining = shuffle(freshDeck().filter((c) => !used.has(cardId(c))), makeRng(seed));
  playerAt(state, seat).hand = remaining.slice(0, 4);
}

/** Seats that have claimed vuile was this round. Public: a claim is a shout. */
export function claimantSeats(state: EngineState): number[] {
  return state.claims.map((c) => c.seat).sort((a, b) => a - b);
}

/**
 * Claim vuile was, or pass. Anyone may claim whether or not their hand really
 * qualifies - the bluff is the point, and whether it was true is only settled
 * if somebody peeks.
 */
export function declareWas(
  prev: EngineState,
  seat: number,
  declare: boolean,
  seed: number,
): EngineState {
  if (prev.phase !== 'declare') throw new Error('not in the declare phase');
  const state = clone(prev);
  if (!(seat in state.declareDecisions)) throw new Error('you are not at this table');
  if (state.declareDecisions[seat] != null) throw new Error('already decided');

  const p = playerAt(state, seat);
  state.declareDecisions[seat] = declare ? 'declare' : 'pass';
  if (declare) {
    state.claims.push({
      seat,
      genuine: hasDirtyLaundry(p.hand),
      challengers: [],
      outcome: null,
      revealed: null,
    });
    log(state, { kind: 'was_claim', seat, text: `${p.name} roept vuile was!` });
  }

  const undecided = Object.values(state.declareDecisions).some((d) => d == null);
  if (undecided) return state;
  return openChallenges(state, seed);
}

/** Everyone has claimed or passed: open the peeking window, or just play on. */
function openChallenges(state: EngineState, seed: number): EngineState {
  if (state.claims.length === 0) return beginPlay(state);

  const claimants = new Set(state.claims.map((c) => c.seat));
  let anyoneCanPeek = false;
  for (const p of state.players) {
    if (p.eliminated) continue;
    // You cannot check yourself, but a claimant may still check another.
    if (claimants.size === 1 && claimants.has(p.seat)) continue;
    state.challengeDecisions[p.seat] = null;
    anyoneCanPeek = true;
  }
  if (!anyoneCanPeek) return resolveClaims(state, seed);

  state.phase = 'challenge';
  log(state, { kind: 'challenge', text: 'Iemand gooit de vuile was. Controleren?' });
  return state;
}

/**
 * Peek at a claim, or let it go. Choices stay hidden until every peek is in, so
 * nobody can wait to see whether somebody else is already checking.
 */
export function challengeWas(
  prev: EngineState,
  seat: number,
  target: number | null,
  seed: number,
): EngineState {
  if (prev.phase !== 'challenge') throw new Error('not in the challenge phase');
  const state = clone(prev);
  if (!(seat in state.challengeDecisions)) throw new Error('you cannot check a claim');
  if (state.challengeDecisions[seat] != null) throw new Error('already decided');

  if (target === null) {
    state.challengeDecisions[seat] = 'pass';
  } else {
    const claim = state.claims.find((c) => c.seat === target);
    if (!claim) throw new Error('nobody claimed vuile was at that seat');
    if (target === seat) throw new Error('you cannot check yourself');
    state.challengeDecisions[seat] = target;
    claim.challengers.push(seat);
  }

  const undecided = Object.values(state.challengeDecisions).some((d) => d == null);
  if (undecided) return state;
  return resolveClaims(state, seed);
}

/**
 * Settle every claim at once, now that all peeks are in.
 *
 * - nobody peeked: the hand is swapped, and whether it was a bluff stays secret
 * - caught bluffing: the liar takes a point and plays on with the hand they
 *   tried to throw away, which everyone has now seen
 * - the claim was true: everyone who doubted it takes a point
 */
function resolveClaims(state: EngineState, seed: number): EngineState {
  let salt = 0;
  for (const claim of state.claims) {
    const p = playerAt(state, claim.seat);

    if (claim.challengers.length === 0) {
      claim.outcome = 'unchallenged';
      swapHand(state, claim.seat, seed + salt++);
      log(state, {
        kind: 'was_swap',
        seat: claim.seat,
        text: `${p.name} gooit de vuile was — vier nieuwe kaarten.`,
      });
      continue;
    }

    // Challenged, so the hand goes face up for everyone to judge.
    claim.revealed = p.hand.map((c) => ({ ...c }));
    const names = claim.challengers.map((s) => playerAt(state, s).name).join(', ');
    const shown = claim.revealed.map(cardId).join(' ');

    if (!claim.genuine) {
      claim.outcome = 'caught';
      p.penalty += 1;
      log(state, {
        kind: 'was_caught',
        seat: claim.seat,
        text: `${names} controleert: ${p.name} blufte (${shown}) — 1 punt, en speelt verder met dezelfde hand.`,
      });
    } else {
      claim.outcome = 'wrong';
      for (const s of claim.challengers) playerAt(state, s).penalty += 1;
      swapHand(state, claim.seat, seed + salt++);
      log(state, {
        kind: 'was_proven',
        seat: claim.seat,
        text: `${names} controleert: ${p.name} had het echt (${shown}) — 1 punt voor ${names}.`,
      });
    }
  }
  return beginPlay(state);
}

// ---- running out of thinking time ---------------------------------------

/** Seats still owing an answer to the pending knock. */
export function pendingKnockSeats(state: EngineState): number[] {
  if (state.phase !== 'knock' || !state.pendingKnock) return [];
  return Object.entries(state.pendingKnock.responses)
    .filter(([, response]) => response == null)
    .map(([seat]) => Number(seat))
    .sort((a, b) => a - b);
}

/** Seats that still owe a poverty play/fold decision. */
export function pendingPovertySeats(state: EngineState): number[] {
  if (state.phase !== 'poverty') return [];
  return state.players
    .filter(
      (p) =>
        !p.eliminated &&
        p.inRound &&
        p.penalty < state.targetPoints - 1 &&
        state.povertyDecisions[p.seat] === undefined,
    )
    .map((p) => p.seat)
    .sort((a, b) => a - b);
}

/** Seats that still owe a vuile-was claim-or-pass. */
export function pendingDeclareSeats(state: EngineState): number[] {
  if (state.phase !== 'declare') return [];
  return Object.entries(state.declareDecisions)
    .filter(([, d]) => d == null)
    .map(([seat]) => Number(seat))
    .sort((a, b) => a - b);
}

/** Seats that still owe a peek-or-let-it-go. */
export function pendingChallengeSeats(state: EngineState): number[] {
  if (state.phase !== 'challenge') return [];
  return Object.entries(state.challengeDecisions)
    .filter(([, d]) => d == null)
    .map(([seat]) => Number(seat))
    .sort((a, b) => a - b);
}

/** True when somebody is on the clock and the round can be moved along. */
export function awaitingAction(state: EngineState): boolean {
  return (
    state.phase === 'playing' ||
    state.phase === 'knock' ||
    state.phase === 'poverty' ||
    state.phase === 'declare' ||
    state.phase === 'challenge'
  );
}

/**
 * Apply the default action for everyone whose thinking time has run out.
 *
 * The defaults are deliberately the most conservative legal move, so a player
 * who steps away is never committed to more than they already accepted:
 *   - playing: lead/follow with their weakest legal card
 *   - knock:   fold, taking the stake as it stood before the knock
 *   - poverty: fold for a single point rather than play for two
 */
export function applyTurnTimeout(prev: EngineState, seed = 0): EngineState {
  if (!awaitingAction(prev)) throw new Error(`nothing to time out in phase ${prev.phase}`);

  if (prev.phase === 'declare') {
    // Silence is not a claim.
    let state = prev;
    for (const seat of pendingDeclareSeats(prev)) {
      if (state.phase !== 'declare') break;
      state = declareWas(state, seat, false, seed);
    }
    return state;
  }

  if (prev.phase === 'challenge') {
    // Silence is not a challenge: checking costs a point when the claim is
    // true, so nobody is made to risk one by walking away.
    let state = prev;
    for (const seat of pendingChallengeSeats(prev)) {
      if (state.phase !== 'challenge') break;
      state = challengeWas(state, seat, null, seed);
    }
    return state;
  }

  if (prev.phase === 'playing') {
    const seat = prev.turnSeat;
    const legal = legalCards(prev, seat);
    if (legal.length === 0) throw new Error('no legal card to auto-play');
    const weakest = legal.reduce((a, b) => (rankStrength(b.rank) < rankStrength(a.rank) ? b : a));
    const state = clone(prev);
    log(state, {
      kind: 'timeout',
      seat,
      text: `Bedenktijd van ${playerAt(state, seat).name} verstreken.`,
    });
    return playCard(state, seat, weakest);
  }

  if (prev.phase === 'knock') {
    let state = clone(prev);
    for (const seat of pendingKnockSeats(prev)) {
      if (state.phase !== 'knock') break; // the knock resolved on an earlier fold
      log(state, {
        kind: 'timeout',
        seat,
        text: `${playerAt(state, seat).name} reageerde niet en vouwt.`,
      });
      state = respondKnock(state, seat, 'fold');
    }
    return state;
  }

  let state = clone(prev);
  for (const seat of pendingPovertySeats(prev)) {
    if (state.phase !== 'poverty') break;
    log(state, {
      kind: 'timeout',
      seat,
      text: `${playerAt(state, seat).name} besliste niet en vouwt.`,
    });
    state = povertyDecide(state, seat, 'fold');
  }
  return state;
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
