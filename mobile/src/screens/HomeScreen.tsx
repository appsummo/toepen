import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { Button, Card, Wordmark } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { colors, radius } from '../theme';
import { createGame, joinGame } from '../api/games';
import { fetchActiveGames } from '../api/users';
import { saveIdentity } from '../game/identity';
import { ApiError } from '../api/client';
import type { ActiveGame, Identity } from '../types';
import type { TabScreenProps } from '../navigation/types';

const TARGET_OPTIONS = [5, 8, 10, 12, 15];
const THINK_OPTIONS = [20, 30, 45, 60];

export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const { user } = useAuth();
  const name = user?.displayName ?? 'Speler';

  const [target, setTarget] = useState(10);
  const [think, setThink] = useState(30);
  const [dirty, setDirty] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [active, setActive] = useState<ActiveGame[]>([]);
  const [loadingActive, setLoadingActive] = useState(true);

  const loadActive = useCallback(() => {
    let alive = true;
    setLoadingActive(true);
    fetchActiveGames()
      .then((games) => alive && setActive(games))
      .catch(() => alive && setActive([]))
      .finally(() => alive && setLoadingActive(false));
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(loadActive);

  const goToGame = async (
    gameCode: string,
    identity: Identity,
    status: string,
  ): Promise<void> => {
    await saveIdentity(gameCode, identity);
    if (status === 'playing') navigation.navigate('Game', { code: gameCode });
    else navigation.navigate('Lobby', { code: gameCode });
  };

  const onCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await createGame({
        name,
        targetPoints: target,
        thinkSeconds: think,
        dirtyLaundry: dirty,
      });
      await goToGame(
        res.game.code,
        { playerId: res.player.id, name: res.player.name, seat: res.player.seat, isHost: true },
        res.game.status,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Kon geen tafel maken');
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      const res = await joinGame(c, name);
      await goToGame(
        res.game.code,
        {
          playerId: res.player.id,
          name: res.player.name,
          seat: res.player.seat,
          isHost: res.player.isHost,
        },
        res.game.status,
      );
      setCode('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Kon niet aanschuiven');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Wordmark size={24} />
          <Text style={styles.hi}>Hoi, {name}</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {active.length > 0 && (
          <Card>
            <Text style={styles.cardTitle}>Verdergaan</Text>
            {active.map((g) => (
              <Pressable
                key={g.id}
                style={styles.activeRow}
                onPress={() =>
                  goToGame(
                    g.code,
                    { playerId: g.player_id, name, seat: g.seat, isHost: false },
                    g.status,
                  )
                }
              >
                <View>
                  <Text style={styles.activeCode}>{g.code}</Text>
                  <Text style={styles.activeMeta}>
                    {g.status === 'playing' ? 'Bezig' : 'In de wachtkamer'} · {g.player_count}{' '}
                    spelers
                  </Text>
                </View>
                <Text style={styles.activeArrow}>›</Text>
              </Pressable>
            ))}
          </Card>
        )}

        <Card>
          <Text style={styles.cardTitle}>Nieuw potje</Text>
          <Selector label="Speeldoel" options={TARGET_OPTIONS} value={target} onChange={setTarget} suffix="ptn" />
          <Selector label="Bedenktijd" options={THINK_OPTIONS} value={think} onChange={setThink} suffix="s" />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Vuile was</Text>
            <Pressable
              onPress={() => setDirty((d) => !d)}
              style={[styles.toggle, dirty ? styles.toggleOn : styles.toggleOff]}
            >
              <Text style={dirty ? styles.toggleOnText : styles.toggleOffText}>
                {dirty ? 'Aan' : 'Uit'}
              </Text>
            </Pressable>
          </View>
          <Button title="Tafel openen" onPress={onCreate} loading={busy} style={styles.mt} />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Meedoen</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="KLAVER-712"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.codeInput}
          />
          <Button
            title="Aanschuiven"
            variant="ghost"
            onPress={onJoin}
            disabled={!code.trim()}
            loading={busy}
            style={styles.mt}
          />
        </Card>

        {loadingActive && active.length === 0 && (
          <ActivityIndicator color={colors.muted} style={styles.mt} />
        )}
      </ScrollView>
    </Screen>
  );
}

function Selector({
  label,
  options,
  value,
  onChange,
  suffix,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <View style={styles.selectorWrap}>
      <Text style={styles.selectorLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const on = opt === value;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={on ? styles.chipOnText : styles.chipText}>
                {opt}
                {suffix}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 16, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  hi: { color: colors.parchment, fontSize: 15, opacity: 0.85 },
  errorBox: { backgroundColor: colors.red, borderRadius: radius.md, padding: 12 },
  errorText: { color: '#fff', fontWeight: '600' },
  cardTitle: { color: colors.goldSoft, fontSize: 19, fontWeight: '700', marginBottom: 12 },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201,143,61,0.15)',
  },
  activeCode: { color: colors.parchment, fontWeight: '700', fontSize: 16, letterSpacing: 1 },
  activeMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  activeArrow: { color: colors.goldSoft, fontSize: 26 },
  selectorWrap: { marginBottom: 12 },
  selectorLabel: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(247,242,230,0.2)',
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.parchment },
  chipOnText: { color: '#3a2408', fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  toggleLabel: { color: colors.parchment, fontSize: 15 },
  toggle: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: radius.pill },
  toggleOn: { backgroundColor: colors.felt },
  toggleOff: { backgroundColor: 'rgba(247,242,230,0.1)' },
  toggleOnText: { color: '#fff', fontWeight: '700' },
  toggleOffText: { color: colors.muted, fontWeight: '700' },
  codeInput: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(247,242,230,0.2)',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    letterSpacing: 2,
    fontWeight: '700',
    color: colors.parchment,
  },
  mt: { marginTop: 8 },
});
