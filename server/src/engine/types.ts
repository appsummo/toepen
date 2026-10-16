import type { Card, Suit } from './cards.js';

export type Phase =
  | 'poverty'      // waiting for poverty play/fold decisions before the round starts
  | 'playing'      // normal trick play
  | 'knock'        // a knock is pending; awaiting call/fold responses
  | 'round_over'   // round resolved, scores applied, waiting for next deal
  | 'game_over';   // one player left standing

export interface EnginePlayer {
  id: string;
  seat: number;
  name: string;
  hand: Card[];
  penalty: number;      // game-level penalty points
  eliminated: boolean;  // reached target points
  inRound: boolean;     // still contesting the current round (not folded)
  folded: boolean;      // folded this round
  foldPenalty: number;  // points locked in when they folded
  usedChance: boolean;  // used "chance for toep" this round
  // Every card this player has played this round, oldest first. Cards stay
  // here once shown - including a card withdrawn from the trick on a fold,
  // because the table already saw it.
  played: ShownCard[];
}

export interface PlayedCard {
  seat: number;
  card: Card;
}

/** A card a player has shown this round, kept face up so everyone can count. */
export interface ShownCard {
  card: Card;
  trick: number; // which trick (0-3) it was played into
}

export interface PendingKnock {
  knockerSeat: number;
  newStake: number;                 // stake level if accepted
  // `null` means "asked, still deciding". It must not be `undefined`: the state
  // is persisted as JSON, and JSON.stringify drops undefined-valued keys, which
  // would erase the record of who was asked and deadlock the knock.
  responses: Record<number, 'call' | 'fold' | null>; // by seat
}

export interface RoundLogEntry {
  kind: string;
  seat?: number;
  text: string;
}

export interface EngineState {
  phase: Phase;
  targetPoints: number;
  dirtyLaundryEnabled: boolean;
  round: number;
  dealerSeat: number;
  turnSeat: number;                 // whose action it is
  leadSuit: Suit | null;
  currentTrick: PlayedCard[];
  trickNumber: number;              // 0..3
  lastTrickWinnerSeat: number | null;
  stake: number;                    // points a caller pays if they lose
  lastKnockerSeat: number | null;   // cannot re-knock themselves
  pendingKnock: PendingKnock | null;
  players: EnginePlayer[];
  povertyDecisions: Record<number, 'play' | 'fold' | undefined>;
  log: RoundLogEntry[];
  // Epoch ms by which the players being waited on must act, or null when
  // nobody is on the clock. Set by the room manager, never read by the engine:
  // the engine stays a pure function of its inputs and knows nothing of time.
  turnDeadline: number | null;
  winnerSeat: number | null;        // round winner (last-trick winner)
  gameWinnerSeat: number | null;    // overall game winner
}
