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
  /** Anyone may claim vuile was, true hand or not — the bluff is the point. */
  mustDeclareWas: boolean;
  /** You may quietly check somebody's claim. Nobody sees whether you did. */
  mustChallengeWas: boolean;
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

export type Phase =
  | 'lobby'
  | 'declare'
  | 'challenge'
  | 'poverty'
  | 'playing'
  | 'knock'
  | 'round_over'
  | 'game_over';

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
  /** Seats that claimed vuile was this round. A claim is shouted, so it is public. */
  wasClaimants?: number[];
  /** Claims that were checked, once resolved. Hidden while the window is open. */
  wasResults?: { seat: number; outcome: 'caught' | 'wrong' | 'unchallenged' | null; revealed: Card[] | null }[];
  /** Epoch ms when the players on the clock run out of time; null when nobody is. */
  turnDeadline?: number | null;
  /** The server's clock when this snapshot was built, for correcting skew. */
  now?: number;
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
