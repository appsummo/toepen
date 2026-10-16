import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadowCard } from '../theme';

type ButtonVariant = 'primary' | 'ghost' | 'red';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const content =
    variant === 'primary' ? (
      <LinearGradient
        colors={[colors.goldBright, colors.gold]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.btn, styles.btnPrimary, isDisabled && styles.dim]}
      >
        {loading ? (
          <ActivityIndicator color="#3a2408" />
        ) : (
          <Text style={styles.btnPrimaryText}>{title}</Text>
        )}
      </LinearGradient>
    ) : (
      <View
        style={[
          styles.btn,
          variant === 'red' ? styles.btnRed : styles.btnGhost,
          isDisabled && styles.dim,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.parchment} />
        ) : (
          <Text style={variant === 'red' ? styles.btnRedText : styles.btnGhostText}>{title}</Text>
        )}
      </View>
    );

  return (
    <Pressable onPress={isDisabled ? undefined : onPress} disabled={isDisabled} style={style}>
      {content}
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & TextInputProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, shadowCard, style]}>{children}</View>;
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <View style={styles.wordmarkRow}>
      <Text style={[styles.wordmark, { fontSize: size }]}>TOEPEN</Text>
      <Text style={[styles.suits, { fontSize: size * 0.7 }]}>♠♥♣♦</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {},
  btnPrimaryText: { color: '#3a2408', fontWeight: '700', fontSize: 16 },
  btnGhost: {
    backgroundColor: 'rgba(247,242,230,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(247,242,230,0.22)',
  },
  btnGhostText: { color: colors.parchment, fontWeight: '700', fontSize: 16 },
  btnRed: { backgroundColor: colors.redBright },
  btnRedText: { color: '#fff1ec', fontWeight: '700', fontSize: 16 },
  dim: { opacity: 0.45 },
  fieldWrap: { gap: 6 },
  label: {
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(247,242,230,0.2)',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.parchment,
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(201,143,61,0.3)',
    borderRadius: radius.lg,
    padding: 18,
  },
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  wordmark: {
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.goldSoft,
  },
  suits: { color: colors.gold, letterSpacing: 2 },
});
