import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '../components/Screen';
import { Button, Card, Wordmark } from '../components/ui';
import { Chat } from '../components/Chat';
import { useTable } from '../game/useTable';
import { colors, radius } from '../theme';
import type { GameView } from '../types';
import type { RootScreenProps } from '../navigation/types';

const TARGET_OPTIONS = [5, 8, 10, 12, 15];
const THINK_OPTIONS = [20, 30, 45, 60];

export function LobbyScreen({ route, navigation }: RootScreenProps<'Lobby'>) {
  const { code } = route.params;
  const { identity, identityLoaded, socket } = useTable(code);
  const { game, messages, connected, error, send } = socket;

  // Once the host starts, everyone moves to the table.
  useEffect(() => {
    if (game && game.phase !== 'lobby' && game.status !== 'lobby') {
      navigation.replace('Game', { code });
    }
  }, [game?.phase, game?.status]);

  if (identityLoaded && !identity) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.dim}>Je zit niet aan deze tafel.</Text>
          <Button title="Terug" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  if (!game || !identity) {
    return (
      <Screen>
        <View style={styles.center}>
          <Wordmark size={22} />
          <ActivityIndicator color={colors.goldSoft} style={{ marginTop: 12 }} />
          <Text style={styles.dim}>{connected ? 'Tafel laden…' : 'Verbinden…'}</Text>
        </View>
      </Screen>
    );
  }

  const isHost = game.hostPlayerId === identity.playerId;
  const me = game.players.find((p) => p.id === identity.playerId);
  const host = game.players.find((p) => p.isHost);
  const readyCount = game.players.filter((p) => p.ready).length;
  const canStart = isHost && game.players.length >= 2;

  const invite = async () => {
    await Share.share({
      message: `Doe je mee met Toepen? Spelcode: ${game.code}`,
    });
  };

  const updateSettings = (patch: Partial<Pick<GameView, 'targetPoints' | 'thinkSeconds' | 'dirtyLaundry'>>) => {
    send({
      type: 'settings',
      targetPoints: patch.targetPoints ?? game.targetPoints,
      thinkSeconds: patch.thinkSeconds ?? game.thinkSeconds,
      dirtyLaundry: patch.dirtyLaundry ?? game.dirtyLaundry,
    });
  };

  return (
    <Screen edges={['top']}>
      {error && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.navigate('MainTabs')}>
            <Text style={styles.back}>‹ Terug</Text>
          </Pressable>
          <Wordmark size={20} />
        </View>

        <Card>
          <Text style={styles.tableTitle}>Tafel van {host?.name ?? '…'}</Text>
          <View style={styles.codeRow}>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{game.code}</Text>
            </View>
            <Button title="Uitnodigen" onPress={invite} style={styles.inviteBtn} />
          </View>
        </Card>

        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Aan tafel</Text>
            <Text style={styles.count}>{game.players.length} van 8</Text>
          </View>
          {game.players.map((p) => (
            <View key={p.id} style={styles.playerRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.playerName}>
                  {p.name}
                  {p.id === identity.playerId && <Text style={styles.you}> (jij)</Text>}
                </Text>
                <View style={styles.tagRow}>
                  {p.isHost && <Tag label="Tafelbaas" bg={colors.red} />}
                  {!p.connected && <Tag label="Weg" bg="#8f8f8f" />}
                </View>
              </View>
              <Text style={[styles.readyTag, p.ready ? styles.readyOn : styles.readyOff]}>
                {p.ready ? 'Klaar' : 'Wacht'}
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Instellingen</Text>
          <SettingRow
            label="Speeldoel"
            value={`${game.targetPoints} ptn`}
            options={isHost ? TARGET_OPTIONS : undefined}
            current={game.targetPoints}
            suffix="ptn"
            onPick={(v) => updateSettings({ targetPoints: v })}
          />
          <SettingRow
            label="Bedenktijd"
            value={`${game.thinkSeconds} s`}
            options={isHost ? THINK_OPTIONS : undefined}
            current={game.thinkSeconds}
            suffix="s"
            onPick={(v) => updateSettings({ thinkSeconds: v })}
          />
          <View style={styles.rowBetween}>
            <Text style={styles.settingLabel}>Vuile was</Text>
            {isHost ? (
              <Pressable
                onPress={() => updateSettings({ dirtyLaundry: !game.dirtyLaundry })}
                style={[styles.toggle, game.dirtyLaundry ? styles.toggleOn : styles.toggleOff]}
              >
                <Text style={game.dirtyLaundry ? styles.toggleOnText : styles.toggleOffText}>
                  {game.dirtyLaundry ? 'Aan' : 'Uit'}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.settingValue}>{game.dirtyLaundry ? 'Aan' : 'Uit'}</Text>
            )}
          </View>
        </Card>

        <View style={styles.actions}>
          {isHost ? (
            <Button title="Start het potje" onPress={() => send({ type: 'start' })} disabled={!canStart} />
          ) : (
            <Button
              title={me?.ready ? 'Toch nog niet' : 'Ik ben klaar'}
              variant={me?.ready ? 'ghost' : 'primary'}
              onPress={() => send({ type: 'ready', ready: !me?.ready })}
            />
          )}
          <Text style={styles.hint}>
            {readyCount}/{game.players.length} klaar
            {isHost && !canStart ? ' · minstens 2 spelers nodig' : ''}
          </Text>
        </View>

        <Card style={styles.chatCard}>
          <Chat
            messages={messages}
            viewerId={identity.playerId}
            onSend={(b) => send({ type: 'chat', body: b })}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Tag({ label, bg }: { label: string; bg: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function SettingRow({
  label,
  value,
  options,
  current,
  suffix,
  onPick,
}: {
  label: string;
  value: string;
  options?: number[];
  current: number;
  suffix: string;
  onPick: (v: number) => void;
}) {
  if (!options) {
    return (
      <View style={styles.rowBetween}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingValue}>{value}</Text>
      </View>
    );
  }
  return (
    <View style={styles.settingBlock}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const on = opt === current;
          return (
            <Pressable key={opt} onPress={() => onPick(opt)} style={[styles.chip, on && styles.chipOn]}>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  dim: { color: colors.parchment, opacity: 0.7 },
  flex: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: colors.goldSoft, fontSize: 16, fontWeight: '600' },
  banner: { backgroundColor: colors.red, padding: 10 },
  bannerText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  tableTitle: { color: colors.parchment, fontSize: 22, fontWeight: '700', marginBottom: 14 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  codeBox: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  codeText: { color: colors.goldSoft, fontSize: 26, fontWeight: '700', letterSpacing: 2 },
  inviteBtn: { flexShrink: 0 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: colors.goldSoft, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  count: { color: '#fff', backgroundColor: colors.felt, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4, fontSize: 13, fontWeight: '600', overflow: 'hidden' },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(201,143,61,0.12)',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#3a2408', fontWeight: '700', fontSize: 17 },
  playerName: { color: colors.parchment, fontWeight: '700', fontSize: 15 },
  you: { color: colors.muted, fontWeight: '400' },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 3 },
  tag: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  readyTag: { fontSize: 13, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  readyOn: { backgroundColor: colors.felt, color: '#fff' },
  readyOff: { color: colors.muted, borderWidth: 1, borderColor: 'rgba(247,242,230,0.2)' },
  settingBlock: { marginBottom: 12 },
  settingLabel: { color: colors.parchment, fontSize: 15, marginBottom: 6 },
  settingValue: { color: colors.goldSoft, fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(247,242,230,0.2)' },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.parchment },
  chipOnText: { color: '#3a2408', fontWeight: '700' },
  toggle: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: radius.pill },
  toggleOn: { backgroundColor: colors.felt },
  toggleOff: { backgroundColor: 'rgba(247,242,230,0.1)' },
  toggleOnText: { color: '#fff', fontWeight: '700' },
  toggleOffText: { color: colors.muted, fontWeight: '700' },
  actions: { gap: 8, alignItems: 'center' },
  hint: { color: colors.muted, fontSize: 13 },
  chatCard: { height: 320, padding: 0, overflow: 'hidden' },
});
