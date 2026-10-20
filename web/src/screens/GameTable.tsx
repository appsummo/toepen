import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Card, GameView, ChatMessage, Identity, ShownCard, ViewPlayer } from '../types.js';
import { PlayingCard } from '../components/PlayingCard.js';
import { Chat } from '../components/Chat.js';
import { useI18n, useT } from '../i18n/index.js';
import { LanguageToggle } from '../i18n/LanguageToggle.js';
import { useIsCompact } from '../useMediaQuery.js';
import type { TranslationKey } from '../i18n/nl.js';

interface Props {
  game: GameView;
  messages: ChatMessage[];
  identity: Identity;
  send: (msg: any) => void;
}

// Penalty points as chalk marks: 卌 for each group of five, then single strokes.
// The stroke MUST be a single-stroke glyph. This used to be U+2016 '‖' (DOUBLE
// vertical line), which draws two strokes per point - three points rendered as six
// strokes and got read as the wrong score. The exact number is shown beside it.
const TALLY_FIVE = '卌';
const TALLY_ONE = '丨'; // U+4E28, a single vertical stroke

function tally(n: number): string {
  const groups: string[] = [];
  for (let i = 0; i < Math.floor(n / 5); i++) groups.push(TALLY_FIVE);
  const ones = n % 5;
  if (ones > 0) groups.push(TALLY_ONE.repeat(ones));
  return groups.join(' ') || '·';
}

/**
 * Whether this player is one of the people currently being waited on. In a
 * knock or a poverty round that is everyone who has not answered yet, not just
 * whoever holds the turn.
 */
function isOnTheClock(game: GameView, p: ViewPlayer): boolean {
  if (p.eliminated || p.folded) return false;
  if (game.phase === 'playing') return game.turnSeat === p.seat;
  if (game.phase === 'knock') {
    return !!game.pendingKnock && game.pendingKnock.responses[p.seat] == null;
  }
  if (game.phase === 'poverty') {
    return p.inRound && p.penalty < game.targetPoints - 1;
  }
  return false;
}

type Tone = 'knock' | 'fold' | 'turn' | 'idle';

/**
 * What to say under a player's name. Returns a key rather than a sentence, so
 * the same logic serves whichever language the viewer picked.
 */
function statusOf(game: GameView, p: ViewPlayer): { key: TranslationKey; tone: Tone } {
  if (p.eliminated) return { key: 'status.out', tone: 'fold' };
  if (p.folded) return { key: 'status.folded', tone: 'fold' };
  if (game.pendingKnock && game.pendingKnock.knockerSeat === p.seat) {
    return { key: 'status.knocking', tone: 'knock' };
  }
  if (game.phase === 'playing' && game.turnSeat === p.seat) {
    return { key: 'status.turn', tone: 'turn' };
  }
  if (game.phase === 'knock' && game.pendingKnock && p.seat in game.pendingKnock.responses) {
    const r = game.pendingKnock.responses[p.seat];
    if (r === 'call') return { key: 'status.calls', tone: 'turn' };
    if (r === 'fold') return { key: 'status.folded', tone: 'fold' };
    return { key: 'status.choosing', tone: 'idle' };
  }
  if (game.lastKnockerSeat === p.seat) return { key: 'status.knocked', tone: 'knock' };
  return { key: 'status.seated', tone: 'idle' };
}

/**
 * The cards a player has already shown this round. Toepen is played with every
 * card face up on the table, so these stay visible until the next deal - that is
 * what lets you count what is still out. Cards overlap just enough to stay
 * compact while keeping each rank and suit readable.
 */
function PlayedPile({ cards, size = 'sm' }: { cards: ShownCard[]; size?: 'sm' | 'md' }) {
  const t = useT();
  if (cards.length === 0) return null;
  const PER_ROW = 4;
  const rows: ShownCard[][] = [];
  for (let i = 0; i < cards.length; i += PER_ROW) rows.push(cards.slice(i, i + PER_ROW));

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: 'flex', justifyContent: 'center' }}>
          {row.map((shown, i) => (
            <div
              key={`${shown.card.suit}${shown.card.rank}${i}`}
              style={{ marginLeft: i === 0 ? 0 : -8 }}
              title={t('table.trick', { n: shown.trick + 1 })}
            >
              <PlayingCard card={shown.card} size={size} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Seconds left on the server's clock, ticking once a second.
 *
 * The deadline is the server's wall clock, so it is read against the server's
 * own `now` from the same snapshot rather than the browser's: a device whose
 * clock is minutes off would otherwise show a countdown that is wrong by that
 * much, or already expired.
 */
function useSecondsLeft(deadline: number | null | undefined, serverNow: number | undefined): number | null {
  const [, tick] = useState(0);
  // The offset is measured once per snapshot and then held. Recomputing it on
  // every render would cancel out the passage of time exactly - the two
  // Date.now() calls subtract away and the countdown freezes.
  const skewRef = useRef(0);
  const measuredAtRef = useRef<number | undefined>(undefined);
  if (serverNow !== undefined && serverNow !== measuredAtRef.current) {
    measuredAtRef.current = serverNow;
    skewRef.current = serverNow - Date.now();
  }

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - (Date.now() + skewRef.current)) / 1000));
}

function Countdown({ seconds }: { seconds: number }) {
  const t = useT();
  // Only worth shouting about once it is nearly up.
  const urgent = seconds <= 5;
  return (
    <span
      title={t('table.think')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 34,
        padding: '1px 8px',
        borderRadius: 999,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 700,
        fontSize: 13,
        color: urgent ? '#fff' : 'var(--parchment)',
        background: urgent ? 'var(--red)' : 'rgba(0,0,0,0.35)',
        border: `1px solid ${urgent ? 'var(--red-bright)' : 'rgba(201,143,61,0.35)'}`,
      }}
    >
      {seconds}s
    </span>
  );
}

const toneColor: Record<Tone, string> = {
  knock: 'var(--gold-soft)',
  fold: '#c98f8f',
  turn: 'var(--felt-line)',
  idle: 'rgba(247,242,230,0.55)',
};

export function GameTable({ game, messages, identity, send }: Props) {
  const { t, tn } = useI18n();
  const compact = useIsCompact();
  const [chatOpen, setChatOpen] = useState(false);
  const you = game.you;
  const opponents = game.players.filter((p) => p.id !== identity.playerId);
  const trick = game.currentTrick ?? [];
  const seatName = (seat: number) => game.players.find((p) => p.seat === seat)?.name ?? '?';
  const secondsLeft = useSecondsLeft(game.turnDeadline, game.now);

  // Closing the drawer on the way back to a wide screen avoids it being stuck
  // "open" as a column that is already visible.
  useEffect(() => {
    if (!compact) setChatOpen(false);
  }, [compact]);

  return (
    <div className="table-shell">
      {/* Table side */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: 'radial-gradient(ellipse at 50% 40%, #6d4522 0%, #3a2410 70%, #271808 100%)',
          overflow: 'hidden',
        }}
      >
        {/* Top bar */}
        {/* Three groups, so the stylesheet can drop the stake onto its own row
            on a phone instead of letting the bar overflow. */}
        <div className="table-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 24px', zIndex: 2 }}>
          <div className="topbar-brand" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="wordmark" style={{ fontSize: 18 }}>TOEPEN</span>
            <span className="suits" style={{ fontSize: 13 }}>♠♥♣♦</span>
          </div>
          <div className="topbar-stake" style={{ textAlign: 'center' }}>
            <div className="topbar-stake-label" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(247,242,230,0.6)' }}>
              {t('table.stake')}
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(18px, 5vw, 26px)', fontWeight: 700, color: 'var(--gold-soft)', whiteSpace: 'nowrap' }}>
              {tn('table.stake', game.stake ?? 1, { n: game.stake ?? 1 })}
            </div>
          </div>
          <div className="topbar-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="topbar-round" style={{ textAlign: 'right', color: 'rgba(247,242,230,0.75)', fontSize: 13 }}>
              {t('table.round', { round: game.round, target: game.targetPoints })}
            </span>
            <LanguageToggle compact />
            <button className="chat-toggle" onClick={() => setChatOpen(true)} aria-expanded={chatOpen}>
              💬 {t('table.chat')}
            </button>
          </div>
        </div>

        {/* Opponents */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(8px, 2vw, 18px)', flexWrap: 'wrap', padding: '4px 12px', zIndex: 2 }}>
          {opponents.map((p) => {
            const st = statusOf(game, p);
            return (
              <div
                key={p.id}
                className="opponent"
                style={{
                  minWidth: 140,
                  textAlign: 'center',
                  opacity: p.folded || p.eliminated ? 0.5 : 1,
                  padding: '10px 12px',
                  borderRadius: 14,
                  background: st.tone === 'turn' ? 'rgba(143,181,157,0.18)' : 'rgba(0,0,0,0.22)',
                  border: st.tone === 'turn' ? '1px solid var(--felt-line)' : '1px solid rgba(201,143,61,0.2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                  {Array.from({ length: p.handCount }).map((_, i) => (
                    <div key={i} style={{ marginLeft: i === 0 ? 0 : -24 }}>
                      <PlayingCard faceDown size="sm" />
                    </div>
                  ))}
                  {p.handCount === 0 && <div style={{ height: 45 }} />}
                </div>
                <div style={{ fontWeight: 700, color: 'var(--parchment)' }}>
                  {p.name}
                  {game.dealerSeat === p.seat && <span title={t('table.dealer')} style={{ marginLeft: 6 }}>🃏</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: toneColor[st.tone], fontWeight: 600 }}>{t(st.key)}</span>
                  {secondsLeft !== null && isOnTheClock(game, p) && <Countdown seconds={secondsLeft} />}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(247,242,230,0.55)', marginTop: 2 }}>
                  {t('table.penalty', { n: p.penalty })}
                </div>
                <PlayedPile cards={p.played} />
              </div>
            );
          })}
        </div>

        {/* Center trick / felt */}
        {/* minHeight 0 lets the felt give up space: a decider round deals eight
            cards, and the taller hands and piles would otherwise push the
            action buttons off the bottom of the screen. */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div
            style={{
              width: 'min(70%, 520px)',
              minHeight: (game.handSize ?? 4) > 4 ? 110 : 150,
              borderRadius: '50% / 40%',
              background: 'radial-gradient(ellipse at 50% 42%, #3e6450, #243029)',
              border: '10px solid #7a4a24',
              boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: 'clamp(10px, 3vw, 24px)',
            }}
          >
            {trick.length === 0 ? (
              <span style={{ fontFamily: 'var(--hand)', fontSize: 'clamp(18px, 4.5vw, 26px)', color: 'rgba(247,242,230,0.55)', textAlign: 'center' }}>
                {game.phase === 'round_over' || game.phase === 'game_over'
                  ? t('table.roundover')
                  : t('table.firstcard')}
              </span>
            ) : (
              <div style={{ display: 'flex', gap: 'clamp(6px, 2vw, 12px)', flexWrap: 'wrap', justifyContent: 'center' }}>
                {trick.map((pc, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <PlayingCard card={pc.card} size="md" />
                    <div style={{ fontSize: 11, color: 'var(--felt-line)', marginTop: 4 }}>{seatName(pc.seat)}</div>
                  </div>
                ))}
              </div>
            )}
            {game.leadSuit && trick.length > 0 && (
              <div style={{ fontSize: 12, color: 'rgba(247,242,230,0.6)' }}>
                {t('table.trickof', { n: (game.trickNumber ?? 0) + 1, total: game.handSize ?? 4 })}
              </div>
            )}
          </div>

          <Standings game={game} identity={identity} />
        </div>

        {/* Your zone */}
        <YourZone game={game} send={send} />

        {(game.phase === 'round_over' || game.phase === 'game_over') && (
          <RoundResult game={game} identity={identity} send={send} seatName={seatName} />
        )}
        {you?.mustRespondKnock && <KnockOverlay game={game} send={send} seatName={seatName} />}
        {you?.mustDecidePoverty && <PovertyOverlay game={game} send={send} />}
      </div>

      {/* Chat side: a column on a desktop, a drawer over the felt on a phone. */}
      {chatOpen && <div className="chat-scrim" onClick={() => setChatOpen(false)} />}
      <div className={chatOpen ? 'table-chat open' : 'table-chat'}>
        <Chat
          messages={messages}
          viewerId={identity.playerId}
          onSend={(b) => send({ type: 'chat', body: b })}
          variant="dark"
          action={
            compact ? (
              <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 12, minHeight: 0 }} onClick={() => setChatOpen(false)}>
                {t('table.chat.close')}
              </button>
            ) : null
          }
        />
      </div>
    </div>
  );
}

function Standings({ game, identity }: { game: GameView; identity: Identity }) {
  const t = useT();
  return (
    <div
      className="scrollbar standings"
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        width: 190,
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(201,143,61,0.25)',
        borderRadius: 12,
        padding: '10px 12px',
      }}
    >
      <div className="standings-title" style={{ fontFamily: 'var(--hand)', fontSize: 18, color: 'var(--gold-soft)', marginBottom: 6 }}>
        {t('standings.title', { target: game.targetPoints })}
      </div>
      {[...game.players].sort((a, b) => a.penalty - b.penalty).map((p) => (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '2px 0', opacity: p.eliminated ? 0.5 : 1 }}>
          <span style={{ color: 'var(--parchment)', fontSize: 13, fontWeight: p.id === identity.playerId ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.id === identity.playerId ? t('standings.you') : p.name}
          </span>
          <span
            style={{ display: 'flex', alignItems: 'baseline', gap: 6, color: p.penalty >= game.targetPoints - 1 ? 'var(--red-bright)' : 'var(--felt-line)' }}
            title={t('standings.points', { n: p.penalty })}
          >
            <span className="tally" style={{ fontSize: 15, letterSpacing: 2, opacity: 0.75 }}>{tally(p.penalty)}</span>
            <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 12, textAlign: 'right' }}>
              {p.penalty}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * The vuile-was prompts.
 *
 * Deliberately a bar above your own hand rather than a modal: both decisions
 * are made by looking at your cards, so covering them would be absurd. Nothing
 * here ever shows who else is checking - that is the whole point of the peek.
 */
function WasPrompt({ game, send, seatName }: { game: GameView; send: (m: any) => void; seatName: (s: number) => string }) {
  const t = useT();
  const you = game.you;
  const secondsLeft = useSecondsLeft(game.turnDeadline, game.now);
  if (!you) return null;

  const bar = (children: React.ReactNode) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        flexWrap: 'wrap',
        margin: '0 auto 10px',
        padding: '10px 16px',
        maxWidth: 680,
        borderRadius: 12,
        background: 'rgba(28,16,6,0.9)',
        border: '1px solid rgba(201,143,61,0.45)',
      }}
    >
      {children}
      {secondsLeft !== null && <Countdown seconds={secondsLeft} />}
    </div>
  );

  if (you.mustDeclareWas) {
    return bar(
      <>
        <span style={{ fontFamily: 'var(--hand)', fontSize: 20, color: 'var(--gold-soft)' }}>
          {t('was.question')}
        </span>
        <span style={{ color: 'rgba(247,242,230,0.7)', fontSize: 13 }}>{t('was.hint')}</span>
        <button className="btn btn-primary" onClick={() => send({ type: 'declareWas', declare: true })}>
          {t('was.throw')}
        </button>
        <button className="btn btn-ghost" onClick={() => send({ type: 'declareWas', declare: false })}>
          {t('was.pass')}
        </button>
      </>,
    );
  }

  if (you.mustChallengeWas) {
    const claimants = game.wasClaimants ?? [];
    return bar(
      <>
        <span style={{ fontFamily: 'var(--hand)', fontSize: 20, color: 'var(--gold-soft)' }}>
          {t('was.claims', { names: claimants.map(seatName).join(', ') })}
        </span>
        <span style={{ color: 'rgba(247,242,230,0.7)', fontSize: 13 }}>{t('was.checkhint')}</span>
        {claimants
          .filter((seat) => seat !== you.seat)
          .map((seat) => (
            <button key={seat} className="btn btn-red" onClick={() => send({ type: 'challengeWas', target: seat })}>
              {t('was.check', { name: seatName(seat) })}
            </button>
          ))}
        <button className="btn btn-ghost" onClick={() => send({ type: 'challengeWas', target: null })}>
          {t('was.leave')}
        </button>
      </>,
    );
  }

  // Decided, but the window is still open on somebody else.
  if (game.phase === 'declare' || game.phase === 'challenge') {
    return bar(<span style={{ color: 'rgba(247,242,230,0.7)' }}>{t('was.waiting')}</span>);
  }
  return null;
}

function YourZone({ game, send }: { game: GameView; send: (m: any) => void }) {
  const t = useT();
  const you = game.you;
  const yourSeat = game.players.find((p) => p.isYou);
  const secondsLeft = useSecondsLeft(game.turnDeadline, game.now);
  if (!you) return null;
  const legalIds = new Set(you.legalCards.map((c) => c.suit + c.rank));
  const isLegal = (c: Card) => legalIds.has(c.suit + c.rank);

  return (
    <div className="your-zone" style={{ zIndex: 3, padding: '10px 24px 20px', background: 'linear-gradient(0deg, rgba(0,0,0,0.35), transparent)' }}>
      <WasPrompt game={game} send={send} seatName={(s) => game.players.find((p) => p.seat === s)?.name ?? '?'} />
      {yourSeat && yourSeat.played.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(247,242,230,0.45)' }}>
            {t('you.played')}
          </span>
          <PlayedPile cards={yourSeat.played} />
        </div>
      )}
      <div className="your-hand" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, flexWrap: 'wrap', minHeight: 90, marginBottom: 12 }}>
        {you.hand.length === 0 && <span style={{ color: 'rgba(247,242,230,0.5)' }}>{t('you.nocards')}</span>}
        {you.hand.map((c, i) => {
          const playable = you.canPlay && isLegal(c);
          return (
            <PlayingCard
              key={c.suit + c.rank + i}
              card={c}
              size="lg"
              disabled={you.canPlay && !playable}
              onClick={playable ? () => send({ type: 'play', card: c }) : undefined}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
        {you.isMyTurn && game.phase === 'playing' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--hand)', fontSize: 22, color: 'var(--gold-soft)' }}>
            {t('you.turn')}
            {secondsLeft !== null && <Countdown seconds={secondsLeft} />}
          </span>
        )}
        {you.canKnock && (
          <button className="btn btn-red" style={{ fontSize: 17, padding: '0.7rem 1.8rem' }} onClick={() => send({ type: 'knock' })}>
            {t('you.knock')}
          </button>
        )}

        {!you.isMyTurn && game.phase === 'playing' && !you.folded && (
          <span style={{ color: 'rgba(247,242,230,0.6)' }}>
            {t('you.waitingfor', { name: game.players.find((p) => p.seat === game.turnSeat)?.name ?? '?' })}
          </span>
        )}
        {you.folded && game.phase !== 'round_over' && (
          <span style={{ color: '#c98f8f', fontStyle: 'italic' }}>{t('you.folded')}</span>
        )}
      </div>
    </div>
  );
}

function KnockOverlay({ game, send, seatName }: { game: GameView; send: (m: any) => void; seatName: (s: number) => string }) {
  const t = useT();
  const knocker = game.pendingKnock ? seatName(game.pendingKnock.knockerSeat) : '';
  const newStake = game.pendingKnock?.newStake ?? 2;
  const secondsLeft = useSecondsLeft(game.turnDeadline, game.now);
  return (
    <Overlay>
      <div style={{ fontFamily: 'var(--hand)', fontSize: 'clamp(24px, 7vw, 30px)', color: 'var(--gold-soft)' }}>
        {t('knock.title', { name: knocker })}
      </div>
      <p style={{ color: 'var(--parchment)', margin: '8px 0 20px' }}>
        {t('knock.question', { stake: newStake, less: newStake - 1 })}
      </p>
      {secondsLeft !== null && (
        <p style={{ color: 'rgba(247,242,230,0.7)', margin: '-10px 0 16px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Countdown seconds={secondsLeft} /> {t('knock.autofold')}
        </p>
      )}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn btn-primary" style={{ fontSize: 17, padding: '0.8rem 2rem' }} onClick={() => send({ type: 'respond', response: 'call' })}>
          {t('knock.call')}
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 17, padding: '0.8rem 2rem' }} onClick={() => send({ type: 'respond', response: 'fold' })}>
          {t('knock.fold')}
        </button>
      </div>
    </Overlay>
  );
}

function PovertyOverlay({ game, send }: { game: GameView; send: (m: any) => void }) {
  const t = useT();
  const secondsLeft = useSecondsLeft(game.turnDeadline, game.now);
  return (
    <Overlay>
      <div style={{ fontFamily: 'var(--hand)', fontSize: 'clamp(24px, 7vw, 30px)', color: 'var(--gold-soft)' }}>
        {t('poverty.title')}
      </div>
      <p style={{ color: 'var(--parchment)', margin: '8px 0 20px', maxWidth: 360, textAlign: 'center' }}>
        {t('poverty.body')}
      </p>
      {secondsLeft !== null && (
        <p style={{ color: 'rgba(247,242,230,0.7)', margin: '-10px 0 16px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Countdown seconds={secondsLeft} /> {t('knock.autofold')}
        </p>
      )}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn btn-primary" style={{ fontSize: 17, padding: '0.8rem 2rem' }} onClick={() => send({ type: 'poverty', decision: 'play' })}>
          {t('poverty.play')}
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 17, padding: '0.8rem 2rem' }} onClick={() => send({ type: 'poverty', decision: 'fold' })}>
          {t('poverty.fold')}
        </button>
      </div>
    </Overlay>
  );
}

/**
 * The end-of-round result.
 *
 * Deliberately NOT a modal: the whole point of the moment is reading the table
 * - the winning trick is still on the felt and every player's cards are still
 * face up in their pile. A centred overlay buried exactly the thing you want to
 * look at, and whoever dealt next took it away before you had. So the result
 * sits in the corner opposite the standings and covers nothing.
 *
 * The end of the *game* is still a modal: there is no table left to study.
 */
function RoundResult({ game, identity, send, seatName }: { game: GameView; identity: Identity; send: (m: any) => void; seatName: (s: number) => string }) {
  const { t, logLine } = useI18n();
  const isGameOver = game.phase === 'game_over';
  const winnerSeat = isGameOver ? game.gameWinnerSeat : game.winnerSeat;
  const winnerName = winnerSeat != null ? seatName(winnerSeat) : '';
  const youWon = winnerSeat != null && game.players.find((p) => p.seat === winnerSeat)?.id === identity.playerId;
  const lastLines = (game.log ?? []).slice(-4);

  if (isGameOver) {
    return (
      <Overlay>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(26px, 8vw, 34px)', fontWeight: 700, color: 'var(--gold-soft)', marginBottom: 6 }}>
          {t('over.title')}
        </div>
        <div style={{ fontSize: 20, color: 'var(--parchment)', marginBottom: 20 }}>
          {youWon ? t('over.youwin') : t('over.winner', { name: winnerName })}
        </div>
        <Link to="/" className="btn btn-primary" style={{ fontSize: 17, padding: '0.8rem 2rem' }}>
          {t('over.new')}
        </Link>
      </Overlay>
    );
  }

  return (
    <div
      className="round-result"
      style={{
        position: 'absolute',
        // Bottom-left: the one corner with nothing in it. Top-left clipped the
        // first opponent's pile, which is exactly what this panel exists to
        // stop covering. On a phone there is no free corner at all, so the
        // stylesheet lays it along the bottom instead.
        bottom: 20,
        left: 20,
        width: 250,
        zIndex: 20,
        background: 'rgba(28,16,6,0.92)',
        border: '1px solid rgba(201,143,61,0.45)',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontFamily: 'var(--hand)', fontSize: 22, color: 'var(--gold-soft)' }}>
        {t('table.roundover')}
      </div>
      <div style={{ fontSize: 17, color: 'var(--parchment)', fontWeight: 600, margin: '2px 0 10px' }}>
        {youWon ? t('result.youwin') : t('result.winner', { name: winnerName })}
      </div>
      <div className="round-result-log" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
        {lastLines.map((l, i) => (
          <div key={i} style={{ color: 'var(--parchment)', opacity: 0.85, fontSize: 13, padding: '1px 0' }}>
            {logLine(l)}
          </div>
        ))}
      </div>
      <div className="round-result-note" style={{ fontSize: 12, color: 'rgba(247,242,230,0.55)', marginBottom: 10 }}>
        {t('result.note')}
      </div>
      <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => send({ type: 'nextRound' })}>
        {t('result.next')}
      </button>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(20,10,3,0.72)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        padding: 24,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}
