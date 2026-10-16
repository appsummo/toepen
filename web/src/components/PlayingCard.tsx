import type { Card, Suit } from '../types.js';

const SUIT_SYMBOL: Record<Suit, string> = { C: '♣', H: '♥', S: '♠', D: '♦' };
const RED_SUITS: Suit[] = ['H', 'D'];

export function suitColor(suit: Suit): string {
  return RED_SUITS.includes(suit) ? 'var(--red)' : '#1a1a1a';
}

interface Props {
  card?: Card;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

const DIMS = {
  sm: { w: 44, h: 62, font: 15, pip: 13 },
  md: { w: 64, h: 90, font: 22, pip: 20 },
  lg: { w: 82, h: 116, font: 28, pip: 26 },
};

export function PlayingCard({ card, faceDown, size = 'md', disabled, selected, onClick }: Props) {
  const d = DIMS[size];
  const clickable = !!onClick && !disabled;

  if (faceDown || !card) {
    return (
      <div
        style={{
          width: d.w,
          height: d.h,
          borderRadius: 8,
          background: 'repeating-linear-gradient(45deg, #7a2f20, #7a2f20 6px, #6b2618 6px, #6b2618 12px)',
          border: '2px solid #c98f3d',
          boxShadow: 'var(--shadow-card)',
        }}
      />
    );
  }

  const color = suitColor(card.suit);
  return (
    <button
      onClick={clickable ? onClick : undefined}
      disabled={disabled}
      style={{
        width: d.w,
        height: d.h,
        borderRadius: 8,
        position: 'relative',
        background: 'linear-gradient(160deg, #ffffff, #f7f2e6)',
        border: selected ? '2px solid var(--gold)' : '1px solid #e0d3b4',
        boxShadow: selected
          ? '0 12px 26px rgba(201,143,61,0.5)'
          : 'var(--shadow-card)',
        transform: selected ? 'translateY(-10px)' : 'none',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease',
        cursor: clickable ? 'pointer' : disabled ? 'not-allowed' : 'default',
        filter: disabled ? 'grayscale(0.5) brightness(0.9)' : 'none',
        opacity: disabled ? 0.65 : 1,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 4,
          left: 6,
          fontFamily: 'var(--serif)',
          fontWeight: 700,
          fontSize: d.font * 0.6,
          lineHeight: 1,
          color,
        }}
      >
        {card.rank}
      </span>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: d.font,
          color,
        }}
      >
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span
        style={{
          position: 'absolute',
          bottom: 4,
          right: 6,
          fontFamily: 'var(--serif)',
          fontWeight: 700,
          fontSize: d.font * 0.6,
          lineHeight: 1,
          color,
          transform: 'rotate(180deg)',
        }}
      >
        {card.rank}
      </span>
    </button>
  );
}
