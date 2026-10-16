import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Card, Suit } from '../types';
import { colors, radius, shadowCard } from '../theme';

const SUIT_SYMBOL: Record<Suit, string> = { C: '♣', H: '♥', S: '♠', D: '♦' };
const RED_SUITS: Suit[] = ['H', 'D'];

function suitColor(suit: Suit): string {
  return RED_SUITS.includes(suit) ? colors.red : '#1a1a1a';
}

type Size = 'sm' | 'md' | 'lg';

const DIMS: Record<Size, { w: number; h: number; font: number }> = {
  sm: { w: 40, h: 56, font: 15 },
  md: { w: 58, h: 82, font: 22 },
  lg: { w: 72, h: 102, font: 28 },
};

interface Props {
  card?: Card;
  faceDown?: boolean;
  size?: Size;
  disabled?: boolean;
  selected?: boolean;
  onPress?: () => void;
}

export function PlayingCard({ card, faceDown, size = 'md', disabled, selected, onPress }: Props) {
  const d = DIMS[size];
  const clickable = !!onPress && !disabled;

  if (faceDown || !card) {
    return (
      <View
        style={[
          styles.base,
          { width: d.w, height: d.h },
          styles.back,
          shadowCard,
        ]}
      />
    );
  }

  const color = suitColor(card.suit);
  const corner = { fontSize: d.font * 0.6, color };

  const body = (
    <View
      style={[
        styles.base,
        { width: d.w, height: d.h },
        styles.face,
        selected && styles.selected,
        disabled && styles.disabled,
        shadowCard,
      ]}
    >
      <Text style={[styles.cornerTL, corner]}>{card.rank}</Text>
      <View style={styles.pipWrap}>
        <Text style={{ fontSize: d.font, color }}>{SUIT_SYMBOL[card.suit]}</Text>
      </View>
      <Text style={[styles.cornerBR, corner]}>{card.rank}</Text>
    </View>
  );

  if (!clickable) return body;
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={4}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    position: 'relative',
  },
  face: {
    backgroundColor: colors.cardWhite,
    borderWidth: 1,
    borderColor: '#e0d3b4',
  },
  back: {
    backgroundColor: colors.woodEdge,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  selected: {
    borderWidth: 2,
    borderColor: colors.gold,
    transform: [{ translateY: -10 }],
  },
  disabled: {
    opacity: 0.5,
  },
  cornerTL: {
    position: 'absolute',
    top: 3,
    left: 5,
    fontWeight: '700',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 3,
    right: 5,
    fontWeight: '700',
    transform: [{ rotate: '180deg' }],
  },
  pipWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
