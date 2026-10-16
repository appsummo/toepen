import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlayingCard } from '../components/PlayingCard';
import { Chat } from '../components/Chat';
import { Button } from '../components/ui';
import { useTable } from '../game/useTable';
import { colors, radius } from '../theme';
import type { Card, GameView, Identity, ShownCard, ViewPlayer } from '../types';
import type { RootScreenProps } from '../navigation/types';

export function GameScreen({ route, navigation }: RootScreenProps<'Game'>) {
  const { code } = route.params;
  const { identity, socket } = useTable(code);
  const { game, messages, connected, error, send } = socket;
  const [chatOpen, setChatOpen] = useState(false);

  if (!game || !identity) {
    return (
      <LinearGradient colors={[colors.bg1, colors.bg2]} style={styles.loading}>
        <ActivityIndicator color={colors.goldSoft} size="large" />
        <Text style={styles.loadingText}>{connected ? 'Tafel laden…' : 'Verbinden…'}</Text>
      </LinearGradient>
    );
  }

  const you = game.you;
  const opponents = game.players.filter((p) => p.id !== identity.playerId);
  const yourSeat = game.players.find((p) => p.id === identity.playerId);
  const trick = game.currentTrick ?? [];
  const seatName = (seat: number) => game.players.find((p) => p.seat === seat)?.name ?? '?';
  const turnName = game.players.find((p) => p.seat === game.turnSeat)?.name;

  const legalIds = new Set((you?.legalCards ?? []).map((c) => c.suit + c.rank));
  const isLegal = (c: Card) => legalIds.has(c.suit + c.rank);

  return (
    <LinearGradient colors={['#6d4522', '#3a2410', '#271808']} style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        {error && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{error}</Text>
          </View>
        )}

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.navigate('MainTabs')} hitSlop={10}>
            <Text style={styles.leave}>‹ Tafel verlaten</Text>
          </Pressable>
          <View style={styles.stakeBox}>
            <Text style={styles.stakeLabel}>Er staat op het spel</Text>
            <Text style={styles.stakeValue}>
              {game.stake ?? 1} {game.stake === 1 ? 'punt' : 'punten'}
            </Text>
          </View>
          <Text style={styles.roundText}>
            Ronde {game.round}
            {'\n'}doel {game.targetPoints}
          </Text>
        </View>

        {/* Opponents */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.opponents}
        >
          {opponents.map((p) => (
            <Opponent key={p.id} game={game} p={p} />
          ))}
        </ScrollView>

        {/* Felt / trick */}
        <View style={styles.feltWrap}>
          <View style={styles.felt}>
            {trick.length === 0 ? (
              <Text style={styles.feltHint}>
                {game.phase === 'round_over' || game.phase === 'game_over'
                  ? 'Ronde afgelopen'
                  : 'Wachten op de eerste kaart…'}
              </Text>
            ) : (
              <View style={styles.trickRow}>
                {trick.map((pc, i) => (
                  <View key={i} style={styles.trickCard}>
                    <PlayingCard card={pc.card} size="md" />
                    <Text style={styles.trickName}>{seatName(pc.seat)}</Text>
                  </View>
                ))}
              </View>
            )}
            {game.leadSuit && trick.length > 0 && (
              <Text style={styles.trickCounter}>Slag {(game.trickNumber ?? 0) + 1} van {game.handSize ?? 4}</Text>
            )}
          </View>
        </View>

        {/* Standings strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.standings}
        >
          {[...game.players]
            .sort((a, b) => a.penalty - b.penalty)
            .map((p) => (
              <View key={p.id} style={[styles.standChip, p.eliminated && styles.standOut]}>
                <Text style={styles.standName}>
                  {p.id === identity.playerId ? 'Jij' : p.name}
                </Text>
                <Text
                  style={[
                    styles.standPts,
                    p.penalty >= game.targetPoints - 1 && { color: colors.redBright },
                  ]}
                >
                  {p.penalty}
                </Text>
              </View>
            ))}
        </ScrollView>

        {/* Your zone */}
        <View style={styles.yourZone}>
          {yourSeat && yourSeat.played.length > 0 && (
            <View style={styles.yourPileRow}>
              <Text style={styles.yourPileLabel}>Door jou gespeeld</Text>
              <PlayedPile cards={yourSeat.played} />
            </View>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hand}
          >
            {you && you.hand.length > 0 ? (
              you.hand.map((c, i) => {
                const playable = you.canPlay && isLegal(c);
                return (
                  <PlayingCard
                    key={c.suit + c.rank + i}
                    card={c}
                    size="lg"
                    disabled={you.canPlay && !playable}
                    onPress={playable ? () => send({ type: 'play', card: c }) : undefined}
                  />
                );
              })
            ) : (
              <Text style={styles.dim}>Geen kaarten</Text>
            )}
          </ScrollView>

          <View style={styles.actionRow}>
            {you?.isMyTurn && game.phase === 'playing' && (
              <Text style={styles.yourTurn}>Jij bent aan de beurt</Text>
            )}
            {!you?.isMyTurn && game.phase === 'playing' && !you?.folded && turnName && (
              <Text style={styles.dim}>Wachten op {turnName}…</Text>
            )}
            {you?.folded && game.phase !== 'round_over' && (
              <Text style={styles.folded}>Je bent gevouwen — kijk maar toe.</Text>
            )}
            {you?.canKnock && (
              <Button title="Toep!" variant="red" onPress={() => send({ type: 'knock' })} />
            )}
            {/* Vuile was moved to a claim-and-peek window at the start of the
                round. The server runs it for every client; the mobile screens
                for it are not built yet, so there is no button here. */}
          </View>
        </View>

        {/* Chat button */}
        <Pressable style={styles.chatFab} onPress={() => setChatOpen(true)}>
          <Text style={styles.chatFabText}>💬</Text>
        </Pressable>

        {/* Overlays */}
        {you?.mustRespondKnock && <KnockOverlay game={game} send={send} seatName={seatName} />}
        {you?.mustDecidePoverty && <PovertyOverlay send={send} />}
        {(game.phase === 'round_over' || game.phase === 'game_over') && (
          <RoundOverlay
            game={game}
            identity={identity}
            send={send}
            seatName={seatName}
            onExit={() => navigation.navigate('MainTabs')}
          />
        )}
      </SafeAreaView>

      {/* Chat modal */}
      <Modal visible={chatOpen} animationType="slide" onRequestClose={() => setChatOpen(false)}>
        <LinearGradient colors={[colors.bg1, colors.bg2]} style={styles.fill}>
          <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Stamtafel</Text>
              <Pressable onPress={() => setChatOpen(false)} hitSlop={10}>
                <Text style={styles.close}>Sluiten</Text>
              </Pressable>
            </View>
            <Chat
              messages={messages}
              viewerId={identity.playerId}
              onSend={(b) => send({ type: 'chat', body: b })}
            />
          </SafeAreaView>
        </LinearGradient>
      </Modal>
    </LinearGradient>
  );
}

/**
 * The cards a player has already shown this round. Toepen keeps every played
 * card face up on the table, so these stay until the next deal and let you
 * count what is still out. Overlapped just enough to stay readable.
 */
function PlayedPile({ cards }: { cards: ShownCard[] }) {
  if (!cards || cards.length === 0) return null;
  return (
    <View style={styles.pile}>
      {cards.map((shown, i) => (
        <View
          key={`${shown.card.suit}${shown.card.rank}${i}`}
          style={i > 0 ? styles.pileOverlap : undefined}
        >
          <PlayingCard card={shown.card} size="sm" />
        </View>
      ))}
    </View>
  );
}

function Opponent({ game, p }: { game: GameView; p: ViewPlayer }) {
  const st = statusOf(game, p);
  const isTurn = st.tone === 'turn';
  return (
    <View
      style={[
        styles.opp,
        isTurn && styles.oppTurn,
        (p.folded || p.eliminated) && styles.oppFaded,
      ]}
    >
      <View style={styles.oppCards}>
        {Array.from({ length: Math.max(p.handCount, 0) }).map((_, i) => (
          <View key={i} style={i > 0 ? styles.oppCardOverlap : undefined}>
            <PlayingCard faceDown size="sm" />
          </View>
        ))}
        {p.handCount === 0 && <View style={{ height: 56 }} />}
      </View>
      <Text style={styles.oppName} numberOfLines={1}>
        {p.name}
        {game.dealerSeat === p.seat ? ' 🃏' : ''}
      </Text>
      <Text style={[styles.oppStatus, { color: toneColor[st.tone] }]}>{st.text}</Text>
      <Text style={styles.oppPts}>{p.penalty} pnt</Text>
      <PlayedPile cards={p.played} />
    </View>
  );
}

function KnockOverlay({
  game,
  send,
  seatName,
}: {
  game: GameView;
  send: (m: any) => void;
  seatName: (s: number) => string;
}) {
  const knocker = game.pendingKnock ? seatName(game.pendingKnock.knockerSeat) : '';
  const newStake = game.pendingKnock?.newStake ?? 2;
  return (
    <Overlay>
      <Text style={styles.overlayTitle}>{knocker} heeft getoept!</Text>
      <Text style={styles.overlayBody}>
        Ga je mee voor {newStake} punten, of vouw je voor {newStake - 1}?
      </Text>
      <View style={styles.overlayButtons}>
        <Button title="Mee" onPress={() => send({ type: 'respond', response: 'call' })} />
        <Button title="Vouw" variant="ghost" onPress={() => send({ type: 'respond', response: 'fold' })} />
      </View>
    </Overlay>
  );
}

function PovertyOverlay({ send }: { send: (m: any) => void }) {
  return (
    <Overlay>
      <Text style={styles.overlayTitle}>Armoede aan tafel</Text>
      <Text style={styles.overlayBody}>
        Iemand staat op het randje. Speel je mee (verlies = 2 punten) of vouw je veilig (1 punt)?
      </Text>
      <View style={styles.overlayButtons}>
        <Button title="Meespelen" onPress={() => send({ type: 'poverty', decision: 'play' })} />
        <Button title="Vouwen" variant="ghost" onPress={() => send({ type: 'poverty', decision: 'fold' })} />
      </View>
    </Overlay>
  );
}

function RoundOverlay({
  game,
  identity,
  send,
  seatName,
  onExit,
}: {
  game: GameView;
  identity: Identity;
  send: (m: any) => void;
  seatName: (s: number) => string;
  onExit: () => void;
}) {
  const isGameOver = game.phase === 'game_over';
  const winnerSeat = isGameOver ? game.gameWinnerSeat : game.winnerSeat;
  const winnerName = winnerSeat != null ? seatName(winnerSeat) : '';
  const youWon =
    winnerSeat != null && game.players.find((p) => p.seat === winnerSeat)?.id === identity.playerId;
  const lastLines = (game.log ?? []).slice(-4);

  return (
    <Overlay>
      <Text style={styles.overlayHeading}>{isGameOver ? '🏆 Spel afgelopen' : 'Ronde afgelopen'}</Text>
      <Text style={styles.overlayBody}>
        {youWon ? 'Jij wint' : `${winnerName} wint`} {isGameOver ? 'het potje!' : 'de ronde.'}
      </Text>
      <View style={styles.logBox}>
        {lastLines.map((l, i) => (
          <Text key={i} style={styles.logLine}>
            {l.text}
          </Text>
        ))}
      </View>
      {isGameOver ? (
        <Button title="Terug naar start" onPress={onExit} />
      ) : (
        <Button title="Volgende ronde delen" onPress={() => send({ type: 'nextRound' })} />
      )}
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.overlayInner}>{children}</View>
    </View>
  );
}

function statusOf(
  game: GameView,
  p: ViewPlayer,
): { text: string; tone: 'knock' | 'fold' | 'turn' | 'idle' } {
  if (p.eliminated) return { text: 'eruit', tone: 'fold' };
  if (p.folded) return { text: 'gevouwen', tone: 'fold' };
  if (game.pendingKnock && game.pendingKnock.knockerSeat === p.seat)
    return { text: 'heeft getoept', tone: 'knock' };
  if (game.phase === 'playing' && game.turnSeat === p.seat)
    return { text: 'aan de beurt', tone: 'turn' };
  if (game.phase === 'knock' && game.pendingKnock && p.seat in game.pendingKnock.responses) {
    const r = game.pendingKnock.responses[p.seat];
    if (r === 'call') return { text: 'gaat mee', tone: 'turn' };
    if (r === 'fold') return { text: 'gevouwen', tone: 'fold' };
    return { text: 'moet kiezen…', tone: 'idle' };
  }
  if (game.lastKnockerSeat === p.seat) return { text: 'toepte', tone: 'knock' };
  return { text: 'aan tafel', tone: 'idle' };
}

const toneColor: Record<string, string> = {
  knock: colors.goldSoft,
  fold: '#c98f8f',
  turn: colors.feltLine,
  idle: 'rgba(247,242,230,0.55)',
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.parchment, opacity: 0.7 },
  banner: { backgroundColor: colors.red, padding: 8 },
  bannerText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  leave: { color: 'rgba(247,242,230,0.75)', fontSize: 13, fontWeight: '600', width: 90 },
  stakeBox: { alignItems: 'center' },
  stakeLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(247,242,230,0.6)',
  },
  stakeValue: { fontSize: 24, fontWeight: '700', color: colors.goldSoft },
  roundText: { color: 'rgba(247,242,230,0.75)', fontSize: 12, textAlign: 'right', width: 90 },
  opponents: { paddingHorizontal: 12, gap: 10, alignItems: 'flex-start', minHeight: 130 },
  opp: {
    minWidth: 120,
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(201,143,61,0.2)',
  },
  oppTurn: {
    backgroundColor: 'rgba(143,181,157,0.18)',
    borderColor: colors.feltLine,
  },
  oppFaded: { opacity: 0.5 },
  oppCards: { flexDirection: 'row', marginBottom: 6, height: 56 },
  oppCardOverlap: { marginLeft: -22 },
  // Face-up piles overlap less than the face-down hand so each rank stays legible.
  pile: { flexDirection: 'row', marginTop: 6 },
  pileOverlap: { marginLeft: -14 },
  yourPileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 2 },
  yourPileLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(247,242,230,0.45)',
  },
  oppName: { color: colors.parchment, fontWeight: '700', fontSize: 14 },
  oppStatus: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  oppPts: { fontSize: 11, color: 'rgba(247,242,230,0.55)', marginTop: 1 },
  feltWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  felt: {
    width: '86%',
    minHeight: 150,
    borderRadius: 90,
    borderWidth: 8,
    borderColor: '#7a4a24',
    backgroundColor: colors.feltDeep,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 10,
  },
  feltHint: { fontSize: 18, color: 'rgba(247,242,230,0.55)', textAlign: 'center' },
  trickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  trickCard: { alignItems: 'center' },
  trickName: { fontSize: 11, color: colors.feltLine, marginTop: 4 },
  trickCounter: { fontSize: 11, color: 'rgba(247,242,230,0.6)' },
  standings: { paddingHorizontal: 12, gap: 8, alignItems: 'center', paddingVertical: 4 },
  standChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(201,143,61,0.2)',
  },
  standOut: { opacity: 0.5 },
  standName: { color: colors.parchment, fontSize: 13, fontWeight: '600' },
  standPts: { color: colors.feltLine, fontSize: 14, fontWeight: '700' },
  yourZone: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  hand: { gap: 8, alignItems: 'flex-end', minHeight: 110, paddingVertical: 4 },
  dim: { color: 'rgba(247,242,230,0.55)' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    minHeight: 44,
    marginTop: 6,
  },
  yourTurn: { fontSize: 18, color: colors.goldSoft, fontWeight: '600' },
  folded: { color: '#c98f8f', fontStyle: 'italic' },
  chatFab: {
    position: 'absolute',
    right: 16,
    bottom: 130,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  chatFabText: { fontSize: 22 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  overlayInner: { alignItems: 'center', gap: 12, maxWidth: 420 },
  overlayHeading: { fontSize: 30, fontWeight: '700', color: colors.goldSoft, textAlign: 'center' },
  overlayTitle: { fontSize: 26, fontWeight: '700', color: colors.goldSoft, textAlign: 'center' },
  overlayBody: { fontSize: 16, color: colors.parchment, textAlign: 'center', lineHeight: 22 },
  overlayButtons: { flexDirection: 'row', gap: 14, marginTop: 8 },
  logBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md,
    padding: 12,
    gap: 3,
    alignSelf: 'stretch',
  },
  logLine: { color: colors.parchment, opacity: 0.85, fontSize: 13, textAlign: 'center' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,143,61,0.25)',
  },
  modalTitle: { color: colors.goldSoft, fontSize: 20, fontWeight: '700' },
  close: { color: colors.goldSoft, fontSize: 16, fontWeight: '600' },
});
