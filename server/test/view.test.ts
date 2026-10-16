import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildView } from '../src/game/view.ts';
import { createEngine, startRound, declareWas, challengeWas } from '../src/engine/engine.ts';
import type { EngineState } from '../src/engine/types.ts';
import type { GameRow, PlayerRow } from '../src/db/repo.ts';

const NAMES = ['A', 'B', 'C'];

function rows(state: EngineState): { game: GameRow; players: PlayerRow[] } {
  const game = {
    id: 'g1',
    code: 'KLAVER-712',
    status: 'playing',
    target_points: 10,
    think_seconds: 30,
    dirty_laundry: true,
    host_player_id: 'p0',
    state,
    results_recorded: false,
    created_at: '',
  } as GameRow;
  const players = state.players.map((p) => ({
    id: p.id,
    game_id: 'g1',
    user_id: null,
    name: p.name,
    seat: p.seat,
    is_host: p.seat === 0,
    ready: true,
    connected: true,
    created_at: '',
  })) as PlayerRow[];
  return { game, players };
}

function openChallengeWindow(): EngineState {
  let state = createEngine(
    NAMES.map((name, i) => ({ id: `p${i}`, seat: i, name, penalty: 0, eliminated: false })),
    { targetPoints: 10, dirtyLaundryEnabled: true },
  );
  state = startRound(state, 4711);
  state = declareWas(state, 0, true, 1);
  state = declareWas(state, 1, false, 1);
  state = declareWas(state, 2, false, 1);
  return state;
}

test('a claim is public but a peek is not', () => {
  let state = openChallengeWindow();
  assert.equal(state.phase, 'challenge');
  state = challengeWas(state, 1, 0, 7); // seat 1 quietly checks seat 0

  const { game, players } = rows(state);
  // Seat 2 has not decided yet and must not be able to tell that seat 1 has.
  const seen = JSON.stringify(buildView(game, players, state, 'p2'));

  assert.ok(seen.includes('wasClaimants'), 'who claimed is public');
  assert.ok(!seen.includes('challengeDecisions'), 'who is checking is not sent');
  assert.ok(!seen.includes('challengers'), 'nor the list of checkers');
  assert.ok(!seen.includes('genuine'), 'nor whether the claim was actually true');
});

test('a viewer only ever sees their own hand', () => {
  const state = openChallengeWindow();
  const { game, players } = rows(state);
  const view = buildView(game, players, state, 'p1');

  for (const p of view.players) {
    if (p.id === 'p1') assert.ok(p.hand, 'your own hand is dealt to you');
    else assert.equal(p.hand, undefined, `seat ${p.seat}'s hand must stay hidden`);
  }
});

test('results are published once the claims resolve', () => {
  let state = openChallengeWindow();
  state = challengeWas(state, 1, 0, 7);
  state = challengeWas(state, 2, null, 7);

  const { game, players } = rows(state);
  const view = buildView(game, players, state, 'p2');
  assert.equal(view.wasResults.length, 1);
  assert.equal(view.wasResults[0].seat, 0);
  // Challenged hands are shown: that is the point of flipping them over.
  assert.ok(view.wasResults[0].revealed);
});
