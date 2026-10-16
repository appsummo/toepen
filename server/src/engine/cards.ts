// Piquet deck for Toepen: 32 cards (2s–6s removed).
// Rank strength low → high: J, Q, K, A, 7, 8, 9, 10.

export type Suit = 'C' | 'H' | 'S' | 'D'; // Klaver, Harten, Schoppen, Ruiten
export type Rank = 'J' | 'Q' | 'K' | 'A' | '7' | '8' | '9' | '10';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const SUITS: Suit[] = ['C', 'H', 'S', 'D'];
export const RANKS: Rank[] = ['J', 'Q', 'K', 'A', '7', '8', '9', '10'];

// Higher number = stronger card.
const RANK_STRENGTH: Record<Rank, number> = {
  J: 1, Q: 2, K: 3, A: 4, '7': 5, '8': 6, '9': 7, '10': 8,
};

export const PICTURE_RANKS: Rank[] = ['J', 'Q', 'K', 'A'];

export function rankStrength(rank: Rank): number {
  return RANK_STRENGTH[rank];
}

export function cardId(card: Card): string {
  return `${card.suit}${card.rank}`;
}

export function isPicture(card: Card): boolean {
  return PICTURE_RANKS.includes(card.rank);
}

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

// Deterministic Fisher–Yates using an injectable RNG (0..1). Never mutates input.
export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Mulberry32 — small deterministic PRNG so rounds are reproducible/testable.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
