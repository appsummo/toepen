import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDeck, cardId, rankStrength } from '../src/engine/cards.ts';
import {
  createEngine,
  startRound,
  playCard,
  knock,
  respondKnock,
  legalCards,
  canKnock,
  inRoundSeats,
  povertyDecide,
  applyTurnTimeout,
  awaitingAction,
  declareWas,
  challengeWas,
  pendingDeclareSeats,
  pendingChallengeSeats,
  claimantSeats,
  hasDirtyLaundry,
  pendingPovertySeats,
  pendingKnockSeats,
  pendingPovertySeats,
} from '../src/engine/engine.ts';
import type { EngineState } from '../src/engine/types.ts';

function newGame(names = ['A', 'B', 'C', 'D']) {
  const seats = names.map((name, i) => ({
    id: `p${i}`,
    seat: i,
    name,
    penalty: 0,
    eliminated: false,
  }));
  return createEngine(seats, { targetPoints: 10, dirtyLaundryEnabled: true });
}

/**
 * Deal and walk straight through the vuile-was window with everyone passing.
 * Most tests are about play, not claims, and a raw startRound now stops in the
 * declare phase - which would make every `if (phase !== 'playing') return`
 * guard below pass vacuously instead of testing anything.
 */
function deal(state: EngineState, seed: number): EngineState {
  let next = startRound(state, seed);
  let guard = 0;
  while (next.phase === 'declare' && guard++ < 20) {
    next = declareWas(next, pendingDeclareSeats(next)[0], false, 1);
  }
  return next;
}

// Drive a full round by always playing each player's first legal card.
function autoPlayRound(state: EngineState): EngineState {
  let guard = 0;
  while (state.phase === 'playing' && guard++ < 100) {
    const seat = state.turnSeat;
    const card = legalCards(state, seat)[0];
    state = playCard(state, seat, card);
  }
  return state;
}

test('fresh deck is 32 unique piquet cards', () => {
  const deck = freshDeck();
  assert.equal(deck.length, 32);
  assert.equal(new Set(deck.map(cardId)).size, 32);
});

test('deals four cards to each active player', () => {
  let state = newGame();
  state = deal(state, 12345);
  for (const p of state.players) assert.equal(p.hand.length, 4);
  assert.ok(state.phase === 'playing' || state.phase === 'round_over');
});

test('a full round resolves and assigns exactly one round winner', () => {
  let state = newGame();
  state = deal(state, 999);
  if (state.phase === 'playing') state = autoPlayRound(state);
  assert.ok(state.phase === 'round_over' || state.phase === 'game_over');
  assert.notEqual(state.winnerSeat, null);
  // Total penalty applied equals stake times number of non-winner in-round losers
  // (special hands excepted); at minimum the winner gained no penalty this round.
});

test('players must follow suit when able', () => {
  let state = newGame();
  state = deal(state, 42);
  if (state.phase !== 'playing') return; // skip if instant-win deal
  const leader = state.turnSeat;
  const first = legalCards(state, leader)[0];
  state = playCard(state, leader, first);
  const next = state.turnSeat;
  const legal = legalCards(state, next);
  const hasLeadSuit = state.players
    .find((p) => p.seat === next)!
    .hand.some((c) => c.suit === state.leadSuit);
  if (hasLeadSuit) {
    assert.ok(legal.every((c) => c.suit === state.leadSuit));
  }
});

test('knock raises the stake and folding removes a player from the round', () => {
  let state = newGame();
  state = deal(state, 7);
  if (state.phase !== 'playing') return;
  const knocker = state.turnSeat;
  assert.ok(canKnock(state, knocker));
  state = knock(state, knocker);
  assert.equal(state.phase, 'knock');
  assert.equal(state.pendingKnock?.newStake, 2);

  const responders = Object.keys(state.pendingKnock!.responses).map(Number);
  // First responder folds, the rest call.
  state = respondKnock(state, responders[0], 'fold');
  for (const s of responders.slice(1)) {
    if (state.phase === 'knock') state = respondKnock(state, s, 'call');
  }
  if (state.phase === 'playing') {
    assert.equal(state.stake, 2);
    assert.ok(!inRoundSeats(state).includes(responders[0]));
  }
});

test('cannot re-knock yourself twice in a row', () => {
  let state = newGame();
  state = deal(state, 7);
  if (state.phase !== 'playing') return;
  const knocker = state.turnSeat;
  state = knock(state, knocker);
  const responders = Object.keys(state.pendingKnock!.responses).map(Number);
  for (const s of responders) if (state.phase === 'knock') state = respondKnock(state, s, 'call');
  if (state.phase === 'playing') {
    assert.equal(canKnock(state, knocker), false);
  }
});

test('game ends when only one player remains', () => {
  let state = newGame(['A', 'B']);
  // Push B to the brink by simulating many rounds.
  let guard = 0;
  while (state.phase !== 'game_over' && guard++ < 200) {
    if (state.phase === 'round_over') state = deal(state, 1000 + guard);
    // In poverty, everyone who can decide chooses to play so rounds keep resolving.
    while (state.phase === 'poverty') {
      const decider = state.players.find(
        (p) => !p.eliminated && p.inRound && p.penalty < state.targetPoints - 1,
      );
      if (!decider) break;
      state = povertyDecide(state, decider.seat, 'play');
    }
    if (state.phase === 'playing') state = autoPlayRound(state);
  }
  assert.equal(state.phase, 'game_over');
  assert.notEqual(state.gameWinnerSeat, null);
});

// Build a three-player final trick in which seat 0 plays the winning card and
// then folds to seat 1's knock. Hands and scores are pinned so the outcome does
// not depend on the deal.
function finalTrickWithFolder(): EngineState {
  let state = newGame(['A', 'B', 'C']);
  state.dealerSeat = 2;
  state = deal(state, 1234);
  state = structuredClone(state);
  for (const p of state.players) {
    p.penalty = 0;
    p.eliminated = false;
    p.inRound = true;
    p.folded = false;
    p.foldPenalty = 0;
  }
  state.phase = 'playing';
  state.trickNumber = 3; // the last trick — its winner takes the round
  state.currentTrick = [];
  state.leadSuit = null;
  state.turnSeat = 0;
  state.stake = 1;
  state.lastKnockerSeat = null;
  state.pendingKnock = null;
  state.winnerSeat = null;
  state.players[0].hand = [{ suit: 'C', rank: '10' }]; // strongest card on the table
  state.players[1].hand = [{ suit: 'C', rank: '9' }];
  state.players[2].hand = [{ suit: 'C', rank: '8' }];

  state = playCard(state, 0, { suit: 'C', rank: '10' });
  state = knock(state, 1);
  state = respondKnock(state, 0, 'fold'); // folds having already played
  state = respondKnock(state, 2, 'call');
  return state;
}

test('a player who folds after playing cannot win the trick or the round', () => {
  let state = finalTrickWithFolder();
  state = playCard(state, 1, { suit: 'C', rank: '9' });
  state = playCard(state, 2, { suit: 'C', rank: '8' });

  assert.equal(state.phase, 'round_over');
  // Seat 0 played the 10 but folded, so the round goes to the best card still
  // on the table — and seat 0 pays the penalty locked in when they folded.
  assert.equal(state.winnerSeat, 1);
  assert.ok(state.players[0].folded);
  assert.equal(state.players[0].penalty, 1);
  assert.equal(state.players[1].penalty, 0); // round winner
  assert.equal(state.players[2].penalty, 2); // called and lost at stake 2
});

test('the trick still waits for every remaining contender after a fold', () => {
  const state = finalTrickWithFolder();
  // The folder's card left the table with them, so the trick is short again:
  // both B and C still owe a card.
  assert.equal(state.phase, 'playing');
  assert.equal(state.currentTrick.length, 0);
  assert.equal(state.leadSuit, null);
  assert.equal(state.turnSeat, 1);

  const afterB = playCard(state, 1, { suit: 'C', rank: '9' });
  assert.equal(afterB.phase, 'playing'); // C must still get to play
  assert.equal(afterB.turnSeat, 2);
});

test('the lead suit shifts when the opening player folds mid-trick', () => {
  let state = newGame(['A', 'B', 'C']);
  state = deal(state, 4242);
  state = structuredClone(state);
  for (const p of state.players) {
    p.penalty = 0;
    p.eliminated = false;
    p.inRound = true;
    p.folded = false;
    p.foldPenalty = 0;
  }
  state.phase = 'playing';
  state.trickNumber = 0;
  state.currentTrick = [];
  state.leadSuit = null;
  state.turnSeat = 0;
  state.stake = 1;
  state.lastKnockerSeat = null;
  state.pendingKnock = null;
  // A leads hearts; B cannot follow and discards a club.
  state.players[0].hand = [{ suit: 'H', rank: 'A' }, { suit: 'H', rank: 'K' }];
  state.players[1].hand = [{ suit: 'C', rank: 'J' }, { suit: 'C', rank: 'Q' }];
  state.players[2].hand = [{ suit: 'S', rank: '7' }, { suit: 'S', rank: '8' }];

  state = playCard(state, 0, { suit: 'H', rank: 'A' });
  state = playCard(state, 1, { suit: 'C', rank: 'J' });
  state = knock(state, 2);
  state = respondKnock(state, 0, 'fold'); // the leader withdraws their hearts
  state = respondKnock(state, 1, 'call');

  // Hearts are gone, so B's club now leads and resolution must not crash.
  assert.equal(state.leadSuit, 'C');
  state = playCard(state, 2, { suit: 'S', rank: '7' });
  assert.equal(state.lastTrickWinnerSeat, 1);
  assert.equal(state.turnSeat, 1);
});

// The server persists the engine state as JSON (a JSONB column), so anything the
// engine relies on must survive a round trip. `undefined` does not.
function persistRoundTrip(state: EngineState): EngineState {
  return JSON.parse(JSON.stringify(state)) as EngineState;
}

test('a pending knock survives being persisted as JSON', () => {
  let state = newGame(['A', 'B', 'C']);
  state = deal(state, 77);
  if (state.phase !== 'playing') return;

  const knocker = state.turnSeat;
  state = knock(state, knocker);
  const asked = Object.keys(state.pendingKnock!.responses).map(Number).sort();
  assert.equal(asked.length, 2); // the two players who are not the knocker

  state = persistRoundTrip(state);
  // The record of who still owes an answer must not be lost in the round trip.
  assert.deepEqual(
    Object.keys(state.pendingKnock!.responses).map(Number).sort(),
    asked,
  );

  // ...and those players must still be able to answer.
  state = respondKnock(state, asked[0], 'call');
  state = respondKnock(state, asked[1], 'fold');
  assert.equal(state.phase, 'playing');
  assert.equal(state.stake, 2);
});

test('players are still prompted to answer a knock after a round trip', () => {
  let state = newGame(['A', 'B', 'C']);
  state = deal(state, 77);
  if (state.phase !== 'playing') return;

  const knocker = state.turnSeat;
  state = persistRoundTrip(knock(state, knocker));

  for (const p of state.players) {
    const owes = p.seat !== knocker;
    assert.equal(
      p.seat in state.pendingKnock!.responses,
      owes,
      `seat ${p.seat} should ${owes ? '' : 'not '}be asked to respond`,
    );
  }
});

test('cards played stay face up per player for the whole round', () => {
  let state = newGame(['A', 'B', 'C']);
  state = deal(state, 31337);
  if (state.phase !== 'playing') return;
  for (const p of state.players) assert.equal(p.played.length, 0);

  // Play one full trick: the centre clears, but the piles must not.
  const firstTrick: string[] = [];
  for (let i = 0; i < 3; i++) {
    const seat = state.turnSeat;
    const card = legalCards(state, seat)[0];
    firstTrick.push(cardId(card));
    state = playCard(state, seat, card);
  }
  assert.equal(state.currentTrick.length, 0, 'the centre of the table clears');
  assert.deepEqual(
    state.players.flatMap((p) => p.played.map((s) => cardId(s.card))).sort(),
    [...firstTrick].sort(),
    'but every card played is still shown in its owner pile',
  );
  for (const p of state.players) {
    assert.equal(p.played.length, 1);
    assert.equal(p.played[0].trick, 0);
  }

  // Play the round out: each player's pile ends up holding all four of its cards.
  state = autoPlayRound(state);
  for (const p of state.players) {
    assert.equal(p.played.length, 4);
    assert.deepEqual(p.played.map((s) => s.trick), [0, 1, 2, 3]);
  }
  // Nothing is shown twice, and the whole round is 12 distinct cards.
  const all = state.players.flatMap((p) => p.played.map((s) => cardId(s.card)));
  assert.equal(new Set(all).size, all.length);

  // A new deal wipes the table.
  state = deal(state, 31338);
  for (const p of state.players) assert.equal(p.played.length, 0);
});

test('a card withdrawn from the trick on a fold stays visible in its pile', () => {
  const state = finalTrickWithFolder();
  const folder = state.players[0];
  assert.ok(folder.folded);
  assert.equal(state.currentTrick.length, 0, 'withdrawn from the contested trick');
  assert.deepEqual(
    folder.played.map((s) => cardId(s.card)),
    ['C10'],
    'but the table already saw it, so it stays countable',
  );
});

test('running out of time plays the weakest legal card', () => {
  let state = newGame(['A', 'B', 'C']);
  state = deal(state, 909);
  if (state.phase !== 'playing') return;

  const seat = state.turnSeat;
  const legal = legalCards(state, seat);
  const weakest = legal.reduce((a, b) => (rankStrength(b.rank) < rankStrength(a.rank) ? b : a));
  const before = state.players.find((p) => p.seat === seat)!.hand.length;

  state = applyTurnTimeout(state);

  const player = state.players.find((p) => p.seat === seat)!;
  assert.equal(player.hand.length, before - 1);
  // The weakest card left the hand and is on the table, not some other card.
  assert.ok(state.players.find((p) => p.seat === seat)!.played.some(
    (shown) => cardId(shown.card) === cardId(weakest),
  ));
  assert.ok(state.log.some((e) => e.kind === 'timeout' && e.seat === seat));
});

test('running out of time on a knock folds rather than calling', () => {
  let state = newGame(['A', 'B', 'C']);
  state = deal(state, 909);
  if (state.phase !== 'playing') return;

  const knocker = state.turnSeat;
  state = knock(state, knocker);
  assert.equal(state.phase, 'knock');
  const asked = pendingKnockSeats(state);
  assert.equal(asked.length, 2);

  state = applyTurnTimeout(state);

  // Everyone who stayed silent folded, so only the knocker is left and the
  // round is theirs - nobody was signed up for the higher stake in absentia.
  for (const seat of asked) {
    assert.ok(state.players.find((p) => p.seat === seat)!.folded, `seat ${seat} should have folded`);
  }
  assert.equal(state.winnerSeat, knocker);
});

test('a timed-out folder pays the pre-knock stake, not the raised one', () => {
  let state = newGame(['A', 'B']);
  state = deal(state, 55);
  if (state.phase !== 'playing') return;

  const knocker = state.turnSeat;
  const other = state.players.find((p) => p.seat !== knocker)!.seat;
  state = knock(state, knocker); // stake would become 2 if called
  state = applyTurnTimeout(state);

  // Folding is the conservative default: one point, not the two a call risked.
  assert.equal(state.players.find((p) => p.seat === other)!.penalty, 1);
  assert.equal(state.players.find((p) => p.seat === knocker)!.penalty, 0);
});

test('awaitingAction marks exactly the phases somebody can be waited on', () => {
  let state = newGame(['A', 'B', 'C']);
  assert.equal(awaitingAction(state), false); // round_over before the first deal
  state = deal(state, 909);
  if (state.phase === 'playing') assert.equal(awaitingAction(state), true);

  const finished = { ...state, phase: 'game_over' as const };
  assert.equal(awaitingAction(finished), false);
  // Nothing to time out once the game is over, so the clock must not be armed.
  assert.throws(() => applyTurnTimeout(finished), /nothing to time out/);
});

test('poverty decisions left unanswered fold', () => {
  let state = newGame(['A', 'B', 'C']);
  // Put one player on the brink so the next deal opens with poverty.
  state.players[0].penalty = state.targetPoints - 1;
  state = deal(state, 2024);
  if (state.phase !== 'poverty') return;

  const undecided = pendingPovertySeats(state);
  assert.ok(undecided.length > 0);

  state = applyTurnTimeout(state);

  for (const seat of undecided) {
    const p = state.players.find((pl) => pl.seat === seat)!;
    assert.ok(p.folded, `seat ${seat} should have folded`);
    assert.equal(p.foldPenalty, 1);
  }
});

// ---- vuile was: claim, peek, resolve ------------------------------------

/**
 * Deal and stop in the declare window, with hands pinned so each player's claim
 * is genuine or a bluff by construction rather than by luck of the deal.
 */
function dealForClaims(): EngineState {
  let state = newGame(['A', 'B', 'C']);
  state = startRound(state, 4711);
  assert.equal(state.phase, 'declare');
  state = structuredClone(state);
  // A genuinely has vuile was: four pictures.
  state.players[0].hand = [
    { suit: 'C', rank: 'J' }, { suit: 'D', rank: 'Q' },
    { suit: 'H', rank: 'K' }, { suit: 'S', rank: 'A' },
  ];
  // B does not: nothing but high cards.
  state.players[1].hand = [
    { suit: 'C', rank: '10' }, { suit: 'D', rank: '9' },
    { suit: 'H', rank: '8' }, { suit: 'S', rank: '7' },
  ];
  state.players[2].hand = [
    { suit: 'H', rank: '10' }, { suit: 'S', rank: '9' },
    { suit: 'C', rank: '8' }, { suit: 'D', rank: '8' },
  ];
  return state;
}

test('a deal opens the vuile-was window for everyone', () => {
  const state = dealForClaims();
  assert.equal(state.phase, 'declare');
  assert.deepEqual(pendingDeclareSeats(state), [0, 1, 2]);
  assert.ok(hasDirtyLaundry(state.players[0].hand));
  assert.ok(!hasDirtyLaundry(state.players[1].hand));
});

test('if nobody claims, the round just begins', () => {
  let state = dealForClaims();
  for (const seat of [0, 1, 2]) state = declareWas(state, seat, false, 1);
  assert.ok(state.phase === 'playing' || state.phase === 'poverty');
  assert.equal(state.claims.length, 0);
});

test('anyone may claim vuile was, holding it or not', () => {
  let state = dealForClaims();
  // Seat 1 is bluffing outright and the engine lets them.
  state = declareWas(state, 1, true, 1);
  assert.equal(state.claims.length, 1);
  assert.equal(state.claims[0].seat, 1);
  assert.equal(state.claims[0].genuine, false);
  assert.deepEqual(claimantSeats(state), [1]);
});

test('an unchallenged claim swaps the hand and keeps the bluff secret', () => {
  let state = dealForClaims();
  const before = state.players[1].hand.map(cardId);
  state = declareWas(state, 1, true, 1); // a bluff
  state = declareWas(state, 0, false, 1);
  state = declareWas(state, 2, false, 1);
  assert.equal(state.phase, 'challenge');

  state = challengeWas(state, 0, null, 7);
  state = challengeWas(state, 2, null, 7);

  const claim = state.claims[0];
  assert.equal(claim.outcome, 'unchallenged');
  assert.equal(claim.revealed, null, 'an unchallenged hand is never shown');
  assert.notDeepEqual(state.players[1].hand.map(cardId), before, 'hand was swapped');
  assert.equal(state.players[1].penalty, 0, 'an unchecked bluff costs nothing');
});

test('a bluff that gets checked costs a point and the hand is not swapped', () => {
  let state = dealForClaims();
  const before = state.players[1].hand.map(cardId);
  state = declareWas(state, 1, true, 1); // bluffing
  state = declareWas(state, 0, false, 1);
  state = declareWas(state, 2, false, 1);

  state = challengeWas(state, 0, 1, 7); // seat 0 peeks at seat 1
  state = challengeWas(state, 2, null, 7);

  const claim = state.claims[0];
  assert.equal(claim.outcome, 'caught');
  assert.equal(state.players[1].penalty, 1, 'the bluffer takes the point');
  assert.equal(state.players[0].penalty, 0, 'the checker was right, so pays nothing');
  assert.deepEqual(
    state.players[1].hand.map(cardId),
    before,
    'a caught bluffer plays on with the hand they tried to throw away',
  );
  assert.deepEqual(claim.revealed?.map(cardId), before, 'and it is shown to the table');
});

test('checking a true claim costs the checker a point', () => {
  let state = dealForClaims();
  const before = state.players[0].hand.map(cardId);
  state = declareWas(state, 0, true, 1); // genuine: four pictures
  state = declareWas(state, 1, false, 1);
  state = declareWas(state, 2, false, 1);

  state = challengeWas(state, 1, 0, 7);
  state = challengeWas(state, 2, null, 7);

  const claim = state.claims[0];
  assert.equal(claim.outcome, 'wrong');
  assert.equal(state.players[1].penalty, 1, 'the doubter pays');
  assert.equal(state.players[0].penalty, 0, 'the honest claimant does not');
  assert.notDeepEqual(state.players[0].hand.map(cardId), before, 'and still gets new cards');
});

test('every checker of a true claim pays, so checking in a crowd is not free', () => {
  let state = dealForClaims();
  state = declareWas(state, 0, true, 1);
  state = declareWas(state, 1, false, 1);
  state = declareWas(state, 2, false, 1);

  state = challengeWas(state, 1, 0, 7);
  state = challengeWas(state, 2, 0, 7);

  assert.deepEqual(state.claims[0].challengers.sort(), [1, 2]);
  assert.equal(state.players[1].penalty, 1);
  assert.equal(state.players[2].penalty, 1);
});

test('you cannot check yourself, or a seat that claimed nothing', () => {
  let state = dealForClaims();
  state = declareWas(state, 0, true, 1);
  state = declareWas(state, 1, true, 1);
  state = declareWas(state, 2, false, 1);
  assert.equal(state.phase, 'challenge');

  assert.throws(() => challengeWas(state, 0, 0, 7), /cannot check yourself/);
  assert.throws(() => challengeWas(state, 2, 2, 7), /nobody claimed/);
});

test('running out of time neither claims nor checks', () => {
  let state = dealForClaims();
  // Nobody answers the declare window: silence is not a claim.
  state = applyTurnTimeout(state, 3);
  assert.equal(state.claims.length, 0);
  assert.ok(state.phase === 'playing' || state.phase === 'poverty');

  let other = dealForClaims();
  other = declareWas(other, 1, true, 1); // a bluff nobody will get round to
  other = declareWas(other, 0, false, 1);
  other = declareWas(other, 2, false, 1);
  assert.equal(other.phase, 'challenge');

  other = applyTurnTimeout(other, 3);
  // Silence must not cost a point: checking a true claim is what costs one.
  assert.equal(other.claims[0].outcome, 'unchallenged');
  assert.equal(other.players[0].penalty, 0);
  assert.equal(other.players[2].penalty, 0);
});

// ---- the decider round --------------------------------------------------

/** Put everyone still in on the brink: one more loss and they are out. */
function onTheBrink(names: string[], targetPoints = 15): EngineState {
  const state = createEngine(
    names.map((name, i) => ({ id: `p${i}`, seat: i, name, penalty: 0, eliminated: false })),
    { targetPoints, dirtyLaundryEnabled: false },
  );
  for (const p of state.players) p.penalty = targetPoints - 1;
  return state;
}

test('when everyone is on the brink the decider is dealt eight cards each', () => {
  let state = onTheBrink(['A', 'B', 'C']);
  state = startRound(state, 99);
  assert.equal(state.handSize, 8);
  for (const p of state.players) assert.equal(p.hand.length, 8);
  assert.ok(state.log.some((e) => e.kind === 'decider'));
});

test('one player further back means an ordinary four-card round', () => {
  let state = onTheBrink(['A', 'B', 'C']);
  state.players[2].penalty = 3; // C has room to spare
  state = startRound(state, 99);
  assert.equal(state.handSize, 4);
  for (const p of state.players) assert.equal(p.hand.length, 4);
});

test('a decider only doubles up while the deck can cover it', () => {
  // Four players need all 32 cards; five would need 40, so they get four each.
  let four = startRound(onTheBrink(['A', 'B', 'C', 'D']), 5);
  assert.equal(four.handSize, 8);
  assert.equal(four.players.reduce((n, p) => n + p.hand.length, 0), 32);

  let five = startRound(onTheBrink(['A', 'B', 'C', 'D', 'E']), 5);
  assert.equal(five.handSize, 4);
});

test('eliminated players are ignored when judging the brink', () => {
  let state = onTheBrink(['A', 'B', 'C']);
  // C is already out, so the two left are both on the brink: still a decider.
  state.players[2].penalty = 15;
  state.players[2].eliminated = true;
  state = startRound(state, 99);
  assert.equal(state.handSize, 8);
  assert.equal(state.players[2].hand.length, 0);
});

test('a decider round runs all eight tricks and settles the game', () => {
  let state = startRound(onTheBrink(['A', 'B']), 777);
  assert.equal(state.phase, 'playing');
  let tricks = 0;
  let guard = 0;
  while (state.phase === 'playing' && guard++ < 100) {
    const seat = state.turnSeat;
    const before = state.trickNumber;
    state = playCard(state, seat, legalCards(state, seat)[0]);
    if (state.trickNumber !== before) tricks++;
  }
  assert.equal(tricks, 7, 'seven completed tricks, then the eighth ends the round');
  for (const p of state.players) assert.equal(p.played.length, 8);

  // Everyone was one point from out, so losing this round ends the game.
  assert.equal(state.phase, 'game_over');
  assert.notEqual(state.gameWinnerSeat, null);
  assert.equal(state.players.filter((p) => !p.eliminated).length, 1);
});

test('everyone on the brink does not stall the round in poverty', () => {
  // Players already in poverty must play, so with everyone there nobody is
  // left to make a decision - opening the phase would hang the round and the
  // turn timer would find nothing to time out.
  let state = startRound(onTheBrink(['A', 'B', 'C']), 99);
  assert.equal(state.phase, 'playing');
  assert.deepEqual(pendingPovertySeats(state), []);

  // And one player further back still gets their say.
  let mixed = onTheBrink(['A', 'B', 'C']);
  mixed.players[2].penalty = 3;
  mixed = startRound(mixed, 99);
  assert.equal(mixed.phase, 'poverty');
  assert.deepEqual(pendingPovertySeats(mixed), [2]);
});

test('a weak hand is judged against the hand it is in', () => {
  const pictures4 = [
    { suit: 'C', rank: 'J' }, { suit: 'D', rank: 'Q' },
    { suit: 'H', rank: 'K' }, { suit: 'S', rank: 'A' },
  ] as const;
  assert.ok(hasDirtyLaundry([...pictures4]));
  // The same four cards are not a weak *eight*-card hand.
  assert.ok(!hasDirtyLaundry([
    ...pictures4,
    { suit: 'C', rank: '10' }, { suit: 'D', rank: '9' },
    { suit: 'H', rank: '8' }, { suit: 'S', rank: '10' },
  ]));
  // Eight pictures is, and so is seven plus a single seven.
  assert.ok(hasDirtyLaundry([
    ...pictures4,
    { suit: 'C', rank: 'Q' }, { suit: 'D', rank: 'K' },
    { suit: 'H', rank: 'A' }, { suit: 'S', rank: 'J' },
  ]));
  assert.ok(hasDirtyLaundry([
    ...pictures4,
    { suit: 'C', rank: 'Q' }, { suit: 'D', rank: 'K' },
    { suit: 'H', rank: 'A' }, { suit: 'S', rank: '7' },
  ]));
});
