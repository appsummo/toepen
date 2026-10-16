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
import { Button, Card } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { colors, radius } from '../theme';
import { fetchStats, fetchHistory } from '../api/users';
import { getServerUrl, setServerUrl } from '../config';
import type { UserStats, GameHistoryEntry } from '../types';

export function ProfileScreen() {
  const { user, logout, refresh } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverUrl, setServerUrlLocal] = useState(getServerUrl());
  const [savedUrl, setSavedUrl] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchStats(), fetchHistory()])
      .then(([s, h]) => {
        if (!alive) return;
        setStats(s);
        setHistory(h);
      })
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(load);

  const saveServer = async () => {
    await setServerUrl(serverUrl);
    setSavedUrl(true);
    setTimeout(() => setSavedUrl(false), 1800);
    await refresh();
  };

  const winPct = stats && stats.gamesPlayed > 0 ? Math.round(stats.winRate * 100) : 0;

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.displayName ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{user?.displayName}</Text>
          <Text style={styles.username}>@{user?.username}</Text>
        </View>

        <Card>
          <Text style={styles.cardTitle}>Statistieken</Text>
          {loading && !stats ? (
            <ActivityIndicator color={colors.muted} />
          ) : (
            <View style={styles.statGrid}>
              <Stat label="Gespeeld" value={String(stats?.gamesPlayed ?? 0)} />
              <Stat label="Gewonnen" value={String(stats?.gamesWon ?? 0)} />
              <Stat label="Winst %" value={`${winPct}%`} />
              <Stat
                label="Beste plek"
                value={stats?.bestPlacement ? `#${stats.bestPlacement}` : '—'}
              />
            </View>
          )}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Laatste potjes</Text>
          {history.length === 0 ? (
            <Text style={styles.dim}>Nog geen potjes gespeeld.</Text>
          ) : (
            history.map((h) => (
              <View key={h.gameId} style={styles.histRow}>
                <Text style={[styles.histResult, h.isWinner && styles.histWin]}>
                  {h.isWinner ? '🏆 Gewonnen' : `#${h.placement} van ${h.playersCount}`}
                </Text>
                <Text style={styles.histMeta}>{new Date(h.finishedAt).toLocaleDateString('nl-NL')}</Text>
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Server</Text>
          <Text style={styles.dim}>Adres van de Toepen-server.</Text>
          <TextInput
            value={serverUrl}
            onChangeText={setServerUrlLocal}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://toepen.example"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Button
            title={savedUrl ? '✓ Opgeslagen' : 'Server opslaan'}
            variant="ghost"
            onPress={saveServer}
            style={styles.mt}
          />
        </Card>

        <Pressable onPress={logout} style={styles.logout}>
          <Text style={styles.logoutText}>Uitloggen</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, gap: 16, paddingBottom: 40 },
  header: { alignItems: 'center', gap: 6, marginBottom: 4 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#3a2408', fontWeight: '700', fontSize: 32 },
  name: { color: colors.parchment, fontSize: 22, fontWeight: '700' },
  username: { color: colors.muted, fontSize: 14 },
  cardTitle: { color: colors.goldSoft, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: {
    flexBasis: '46%',
    flexGrow: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { color: colors.goldSoft, fontSize: 26, fontWeight: '700' },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201,143,61,0.12)',
  },
  histResult: { color: colors.parchment, fontSize: 15, fontWeight: '600' },
  histWin: { color: colors.goldSoft },
  histMeta: { color: colors.muted, fontSize: 13 },
  dim: { color: colors.muted, fontSize: 14 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(247,242,230,0.2)',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.parchment,
    marginTop: 8,
  },
  mt: { marginTop: 10 },
  logout: { alignItems: 'center', padding: 14 },
  logoutText: { color: colors.redBright, fontSize: 16, fontWeight: '700' },
});
