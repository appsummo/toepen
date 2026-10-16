import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Card, GameView, ChatMessage, Identity, ShownCard, ViewPlayer } from '../types.js';
import { PlayingCard } from '../components/PlayingCard.js';
import { Chat } from '../components/Chat.js';

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

function statusOf(game: GameView, p: ViewPlayer): { text: string; tone: 'knock' | 'fold' | 'turn' | 'idle' } {
  if (p.eliminated) return { text: 'eruit', tone: 'fold' };
  if (p.folded) return { text: 'gevouwen', tone: 'fold' };
  if (game.pendingKnock && game.pendingKnock.knockerSeat === p.seat) return { text: 'heeft getoept', tone: 'knock' };
  if (game.phase === 'playing' && game.turnSeat === p.seat) return { text: 'aan de beurt', tone: 'turn' };
  if (game.phase === 'knock' && game.pendingKnock && p.seat in game.pendingKnock.responses) {
    const r = game.pendingKnock.responses[p.seat];
    if (r === 'call') return { text: 'gaat mee', tone: 'turn' };
    if (r === 'fold') return { text: 'gevouwen', tone: 'fold' };
    return { text: 'moet kiezen…', tone: 'idle' };
  }
  if (game.lastKnockerSeat === p.seat) return { text: 'toepte', tone: 'knock' };
  return { text: 'aan tafel', tone: 'idle' };
}

/**
 * The cards a player has already shown this round. Toepen is played with every
 * card face up on the table, so these stay visible until the next deal - that is
 * what lets you count what is still out. Cards overlap just enough to stay
 * compact while keeping each rank and suit readable.
 */
function PlayedPile({ cards, size = 'sm' }: { cards: ShownCard[]; size?: 'sm' | 'md' }) {
  if (cards.length === 0) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {cards.map((shown, i) => (
          <div
            key={`${shown.card.suit}${shown.card.rank}${i}`}
            style={{ marginLeft: i === 0 ? 0 : -8 }}
            title={`Slag ${shown.trick + 1}`}
          >
            <PlayingCard card={shown.card} size={size} />
          </div>
        ))}
      </div>
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
  // Only worth shouting about once it is nearly up.
  const urgent = seconds <= 5;
  return (
    <span
      title="Bedenktijd"
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

const toneColor: Record<string, string> = {
  knock: 'var(--gold-soft)',
  fold: '#c98f8f',
  turn: 'var(--felt-line)',
  idle: 'rgba(247,242,230,0.55)',
};

export function GameTable({ game, messages, identity, send }: Props) {
  const you = game.you;
  const opponents = game.players.filter((p) => p.id !== identity.playerId);
  const trick = game.currentTrick ?? [];
  const seatName = (seat: number) => game.players.find((p) => p.seat === seat)?.name ?? '?';
  const secondsLeft = useSecondsLeft(game.turnDeadline, game.now);

  return (
    <div style={{ height: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="wordmark" style={{ fontSize: 18 }}>TOEPEN</span>
            <span className="suits" style={{ fontSize: 13 }}>♠♥♣♦</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(247,242,230,0.6)' }}>
              Er staat op het spel
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, color: 'var(--gold-soft)' }}>
              {game.stake ?? 1} {game.stake === 1 ? 'punt' : 'punten'}
            </div>
          </div>
          <div style={{ textAlign: 'right', color: 'rgba(247,242,230,0.75)', fontSize: 14 }}>
            Ronde {game.round} · doel {game.targetPoints}
          </div>
        </div>

        {/* Opponents */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', padding: '4px 20px', zIndex: 2 }}>
          {opponents.map((p) => {
            const st = statusOf(game, p);
            return (
              <div
                key={p.id}
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
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 6 }}>
                  {Array.from({ length: p.handCount }).map((_, i) => (
                    <PlayingCard key={i} faceDown size="sm" />
                  ))}
                  {p.handCount === 0 && <div style={{ height: 62 }} />}
                </div>
                <div style={{ fontWeight: 700, color: 'var(--parchment)' }}>
                  {p.name}
                  {game.dealerSeat === p.seat && <span title="gever" style={{ marginLeft: 6 }}>🃏</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, color: toneColor[st.tone], fontWeight: 600 }}>{st.text}</span>
                  {secondsLeft !== null && isOnTheClock(game, p) && <Countdown seconds={secondsLeft} />}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(247,242,230,0.55)', marginTop: 2 }}>{p.penalty} pnt</div>
                <PlayedPile cards={p.played} />
              </div>
            );
          })}
        </div>

        {/* Center trick / felt */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div
            style={{
              width: 'min(70%, 520px)',
              minHeight: 200,
              borderRadius: '50% / 40%',
              background: 'radial-gradient(ellipse at 50% 42%, #3e6450, #243029)',
              border: '10px solid #7a4a24',
              boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: 24,
            }}
          >
            {trick.length === 0 ? (
              <span style={{ fontFamily: 'var(--hand)', fontSize: 26, color: 'rgba(247,242,230,0.55)' }}>
                {game.phase === 'round_over' || game.phase === 'game_over' ? 'Ronde afgelopen' : 'Wachten op de eerste kaart…'}
              </span>
            ) : (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                {trick.map((pc, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <PlayingCard card={pc.card} size="md" />
                    <div style={{ fontSize: 12, color: 'var(--felt-line)', marginTop: 4 }}>{seatName(pc.seat)}</div>
                  </div>
                ))}
              </div>
            )}
            {game.leadSuit && trick.length > 0 && (
              <div style={{ fontSize: 12, color: 'rgba(247,242,230,0.6)' }}>Slag {(game.trickNumber ?? 0) + 1} van 4</div>
            )}
          </div>

          <Standings game={game} identity={identity} />
        </div>

        {/* Your zone */}
        <YourZone game={game} send={send} />

        {(game.phase === 'round_over' || game.phase === 'game_over') && (
          <RoundOverlay game={game} identity={identity} send={send} seatName={seatName} />
        )}
        {you?.mustRespondKnock && <KnockOverlay game={game} send={send} seatName={seatName} />}
        {you?.mustDecidePoverty && <PovertyOverlay game={game} send={send} />}
      </div>

      {/* Chat side */}
      <div style={{ background: 'linear-gradient(175deg, #31200f, #1e1207)', borderLeft: '1px solid rgba(201,143,61,0.3)', height: '100vh', overflow: 'hidden' }}>
        <Chat messages={messages} viewerId={identity.playerId} onSend={(b) => send({ type: 'chat', body: b })} variant="dark" />
      </div>
    </div>
  );
}

function Standings({ game, identity }: { game: GameView; identity: Identity }) {
  return (
    <div
      className="scrollbar"
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
      <div style={{ fontFamily: 'var(--hand)', fontSize: 18, color: 'var(--gold-soft)', marginBottom: 6 }}>
        Stand — armoede op {game.targetPoints}
      </div>
      {[...game.players].sort((a, b) => a.penalty - b.penalty).map((p) => (
        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '2px 0', opacity: p.eliminated ? 0.5 : 1 }}>
          <span style={{ color: 'var(--parchment)', fontSize: 13, fontWeight: p.id === identity.playerId ? 700 : 400 }}>
            {p.id === identity.playerId ? 'Jij' : p.name}
          </span>
          <span
            style={{ display: 'flex', alignItems: 'baseline', gap: 6, color: p.penalty >= game.targetPoints - 1 ? 'var(--red-bright)' : 'var(--felt-line)' }}
            title={`${p.penalty} punten`}
          >
            <span style={{ fontSize: 15, letterSpacing: 2, opacity: 0.75 }}>{tally(p.penalty)}</span>
            <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 12, textAlign: 'right' }}>
              {p.penalty}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function YourZone({ game, send }: { game: GameView; send: (m: any) => void }) {
  const you = game.you;
  const yourSeat = game.players.find((p) => p.isYou);
  const secondsLeft = useSecondsLeft(game.turnDeadline, game.now);
  if (!you) return null;
  const legalIds = new Set(you.legalCards.map((c) => c.suit + c.rank));
  const isLegal = (c: Card) => legalIds.has(c.suit + c.rank);

  return (
    <div style={{ zIndex: 3, padding: '10px 24px 20px', background: 'linear-gradient(0deg, rgba(0,0,0,0.35), transparent)' }}>
      {yourSeat && yourSeat.played.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(247,242,230,0.45)' }}>
            Door jou gespeeld
          </span>
          <PlayedPile cards={yourSeat.played} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, minHeight: 120, marginBottom: 12 }}>
        {you.hand.length === 0 && <span style={{ color: 'rgba(247,242,230,0.5)' }}>Geen kaarten meer</span>}
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
            Jij bent aan de beurt
            {secondsLeft !== null && <Countdown seconds={secondsLeft} />}
          </span>
        )}
        {you.canKnock && (
          <button className="btn btn-red" style={{ fontSize: 17, padding: '0.7rem 1.8rem' }} onClick={() => send({ type: 'knock' })}>
            Toep!
          </button>
        )}
        {you.canDirtyLaundry && (
          <button className="btn btn-ghost" onClick={() => send({ type: 'dirtyLaundry' })}>
            Vuile was
          </button>
        )}
        {!you.isMyTurn && game.phase === 'playing' && !you.folded && (
          <span style={{ color: 'rgba(247,242,230,0.6)' }}>Wachten op {game.players.find((p) => p.seat === game.turnSeat)?.name}…</span>
        )}
        {you.folded && game.phase !== 'round_over' && (
          <span style={{ color: '#c98f8f', fontStyle: 'italic' }}>Je bent gevouwen — kijk maar toe.</span>
        )}
      </div>
    </div>
  );
}

function KnockOverlay({ game, send, seatName }: { game: GameView; send: (m: any) => void; seatName: (s: number) => string }) {
  const knocker = game.pendingKnock ? seatName(game.pendingKnock.knockerSeat) : '';
  const newStake = game.pendingKnock?.newStake ?? 2;
  const secondsLeft = useSecondsLeft(game.turnDeadline, game.now);
  return (
    <Overlay>
      <div style={{ fontFamily: 'var(--hand)', fontSize: 30, color: 'var(--gold-soft)' }}>{knocker} heeft getoept!</div>
      <p style={{ color: 'var(--parchment)', margin: '8px 0 20px' }}>
        Ga je mee voor <strong>{newStake} punten</strong>, of vouw je voor {newStake - 1}?
      </p>
      {secondsLeft !== null && (
        <p style={{ color: 'rgba(247,242,230,0.7)', margin: '-10px 0 16px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Countdown seconds={secondsLeft} /> anders vouw je automatisch
        </p>
      )}
      <div style={{ display: 'flex', gap: 14 }}>
        <button className="btn btn-primary" style={{ fontSize: 17, padding: '0.8rem 2rem' }} onClick={() => send({ type: 'respond', response: 'call' })}>
          Mee
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 17, padding: '0.8rem 2rem' }} onClick={() => send({ type: 'respond', response: 'fold' })}>
          Vouw
        </button>
      </div>
    </Overlay>
  );
}

function PovertyOverlay({ game, send }: { game: GameView; send: (m: any) => void }) {
  const secondsLeft = useSecondsLeft(game.turnDeadline, game.now);
  return (
    <Overlay>
      <div style={{ fontFamily: 'var(--hand)', fontSize: 30, color: 'var(--gold-soft)' }}>Armoede aan tafel</div>
      <p style={{ color: 'var(--parchment)', margin: '8px 0 20px', maxWidth: 360, textAlign: 'center' }}>
        Iemand staat op het randje. Speel je mee (verlies = 2 punten) of vouw je veilig (1 punt)?
      </p>
      {secondsLeft !== null && (
        <p style={{ color: 'rgba(247,242,230,0.7)', margin: '-10px 0 16px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Countdown seconds={secondsLeft} /> anders vouw je automatisch
        </p>
      )}
      <div style={{ display: 'flex', gap: 14 }}>
        <button className="btn btn-primary" style={{ fontSize: 17, padding: '0.8rem 2rem' }} onClick={() => send({ type: 'poverty', decision: 'play' })}>
          Meespelen
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 17, padding: '0.8rem 2rem' }} onClick={() => send({ type: 'poverty', decision: 'fold' })}>
          Vouwen
        </button>
      </div>
    </Overlay>
  );
}

function RoundOverlay({ game, identity, send, seatName }: { game: GameView; identity: Identity; send: (m: any) => void; seatName: (s: number) => string }) {
  const isGameOver = game.phase === 'game_over';
  const winnerSeat = isGameOver ? game.gameWinnerSeat : game.winnerSeat;
  const winnerName = winnerSeat != null ? seatName(winnerSeat) : '';
  const youWon = winnerSeat != null && game.players.find((p) => p.seat === winnerSeat)?.id === identity.playerId;
  const lastLines = (game.log ?? []).slice(-4);

  return (
    <Overlay>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 700, color: 'var(--gold-soft)', marginBottom: 6 }}>
        {isGameOver ? '🏆 Spel afgelopen' : 'Ronde afgelopen'}
      </div>
      <div style={{ fontSize: 20, color: 'var(--parchment)', marginBottom: 14 }}>
        {youWon ? 'Jij wint' : `${winnerName} wint`} {isGameOver ? 'het potje!' : 'de ronde.'}
      </div>
      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '10px 16px', marginBottom: 20, maxWidth: 420 }}>
        {lastLines.map((l, i) => (
          <div key={i} style={{ color: 'var(--parchment)', opacity: 0.85, fontSize: 14, padding: '2px 0' }}>{l.text}</div>
        ))}
      </div>
      {isGameOver ? (
        <Link to="/" className="btn btn-primary" style={{ fontSize: 17, padding: '0.8rem 2rem' }}>
          Nieuw potje
        </Link>
      ) : (
        <button className="btn btn-primary" style={{ fontSize: 17, padding: '0.8rem 2rem' }} onClick={() => send({ type: 'nextRound' })}>
          Volgende ronde delen
        </button>
      )}
    </Overlay>
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
