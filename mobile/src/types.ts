export type Suit = 'C' | 'H' | 'S' | 'D';
export type Rank = 'J' | 'Q' | 'K' | 'A' | '7' | '8' | '9' | '10';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface PlayedCard {
  seat: number;
  card: Card;
}

/** A card a player has already shown this round (their face-up pile). */
export interface ShownCard {
  card: Card;
  trick: number;
}

export interface ViewPlayer {
  id: string;
  seat: number;
  name: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  penalty: number;
  eliminated: boolean;
  inRound: boolean;
  folded: boolean;
  handCount: number;
  played: ShownCard[];
  hand?: Card[];
  isYou: boolean;
}

export interface YouView {
  seat: number;
  hand: Card[];
  inRound: boolean;
  folded: boolean;
  eliminated: boolean;
  isMyTurn: boolean;
  legalCards: Card[];
  canKnock: boolean;
  canPlay: boolean;
  canDirtyLaundry: boolean;
  mustRespondKnock: boolean;
  mustDecidePoverty: boolean;
}

export interface PendingKnock {
  knockerSeat: number;
  newStake: number;
  responses: Record<number, 'call' | 'fold' | null>;
}

export interface LogEntry {
  kind: string;
  seat?: number;
  text: string;
}

export type Phase = 'lobby' | 'poverty' | 'playing' | 'knock' | 'round_over' | 'game_over';

export interface GameView {
  id: string;
  code: string;
  status: string;
  targetPoints: number;
  thinkSeconds: number;
  dirtyLaundry: boolean;
  hostPlayerId: string | null;
  viewerId: string | null;
  phase: Phase;
  round: number;
  dealerSeat?: number;
  turnSeat?: number;
  leadSuit?: Suit | null;
  currentTrick?: PlayedCard[];
  trickNumber?: number;
  stake?: number;
  lastKnockerSeat?: number | null;
  pendingKnock?: PendingKnock | null;
  winnerSeat?: number | null;
  gameWinnerSeat?: number | null;
  log?: LogEntry[];
  players: ViewPlayer[];
  you?: YouView | null;
}

export interface ChatMessage {
  id: string;
  player_id: string | null;
  name: string;
  body: string;
  kind: string;
  created_at: string;
}

export interface Identity {
  playerId: string;
  name: string;
  seat: number;
  isHost: boolean;
}

// ---- accounts ----

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  bestPlacement: number | null;
  avgPlacement: number | null;
}

export interface GameHistoryEntry {
  gameId: string;
  isWinner: boolean;
  placement: number;
  finalPenalty: number;
  playersCount: number;
  finishedAt: string;
}

export interface ActiveGame {
  id: string;
  code: string;
  status: string;
  seat: number;
  player_id: string;
  player_count: number;
  updated_at: string;
}

// ---- websocket outgoing messages ----

export type Outgoing =
  | { type: 'chat'; body: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'settings'; targetPoints: number; thinkSeconds: number; dirtyLaundry: boolean }
  | { type: 'start' }
  | { type: 'play'; card: Card }
  | { type: 'knock' }
  | { type: 'respond'; response: 'call' | 'fold' }
  | { type: 'poverty'; decision: 'play' | 'fold' }
  | { type: 'dirtyLaundry' }
  | { type: 'nextRound' };
