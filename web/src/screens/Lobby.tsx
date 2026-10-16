import { useState } from 'react';
import type { GameView, ChatMessage, Identity } from '../types.js';
import { Chat } from '../components/Chat.js';

interface Props {
  game: GameView;
  messages: ChatMessage[];
  identity: Identity;
  send: (msg: any) => void;
}

export function Lobby({ game, messages, identity, send }: Props) {
  const [copied, setCopied] = useState(false);
  const me = game.players.find((p) => p.id === identity.playerId);
  const isHost = game.hostPlayerId === identity.playerId;
  const host = game.players.find((p) => p.isHost);
  const capacity = 8;
  const readyCount = game.players.filter((p) => p.ready).length;
  const canStart = isHost && game.players.length >= 2;

  const copyInvite = async () => {
    const url = `${location.origin}/game/${game.code}`;
    try {
      await navigator.clipboard.writeText(`Doe je mee met Toepen? ${url} (code: ${game.code})`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 5vw' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="wordmark" style={{ fontSize: 22 }}>TOEPEN</span>
          <span className="suits" style={{ fontSize: 15 }}>♠♥♣♦</span>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 1fr)',
          gap: 24,
          padding: '0 5vw 3vh',
          alignItems: 'start',
        }}
      >
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="parchment" style={{ padding: '1.6rem' }}>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, marginBottom: 16 }}>
              Tafel van {host?.name ?? '…'}
            </h1>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div className="label" style={{ marginBottom: 4 }}>Spelcode</div>
                <div
                  style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 34,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: 'var(--red)',
                    background: 'var(--parchment-3)',
                    border: '1px dashed var(--gold)',
                    borderRadius: 10,
                    padding: '6px 18px',
                  }}
                >
                  {game.code}
                </div>
              </div>
              <button className="btn btn-primary" onClick={copyInvite}>
                {copied ? '✓ Gekopieerd' : 'Kopieer uitnodiging'}
              </button>
            </div>
          </div>

          <div className="parchment" style={{ padding: '1.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>Aan tafel</h2>
              <span className="chip" style={{ background: 'var(--felt)', color: '#fff' }}>
                {game.players.length} van {capacity}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {game.players.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: p.id === identity.playerId ? 'rgba(201,143,61,0.14)' : 'var(--parchment-3)',
                    border: '1px solid var(--cream-line)',
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      background: 'linear-gradient(180deg, var(--gold-bright), var(--gold))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: '#3a2408',
                      fontSize: 17,
                    }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
                      {p.name}
                      {p.id === identity.playerId && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(jij)</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                      {p.isHost && <span className="chip" style={{ background: 'var(--red)', color: '#fff', fontSize: 11 }}>Tafelbaas</span>}
                      {!p.connected && <span className="chip" style={{ background: '#8f8f8f', color: '#fff', fontSize: 11 }}>Weg</span>}
                    </div>
                  </div>
                  <span
                    className="chip"
                    style={{
                      background: p.ready ? 'var(--felt)' : 'transparent',
                      color: p.ready ? '#fff' : 'var(--muted-2)',
                      border: p.ready ? 'none' : '1px solid var(--cream-line)',
                    }}
                  >
                    {p.ready ? 'Klaar om te spelen' : 'Nog niet klaar'}
                  </span>
                </div>
              ))}
              {game.players.length < capacity && (
                <div style={{ padding: '10px 12px', color: 'var(--muted)', fontStyle: 'italic' }}>
                  Wachten op speler…
                </div>
              )}
            </div>
          </div>

          <Settings game={game} isHost={isHost} send={send} />

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {!isHost && (
              <button
                className={me?.ready ? 'btn btn-ghost' : 'btn btn-primary'}
                style={me?.ready ? { color: 'var(--parchment)' } : undefined}
                onClick={() => send({ type: 'ready', ready: !me?.ready })}
              >
                {me?.ready ? 'Toch nog niet' : 'Ik ben klaar'}
              </button>
            )}
            {isHost && (
              <button className="btn btn-primary" style={{ fontSize: 18, padding: '1rem 2.2rem' }} disabled={!canStart} onClick={() => send({ type: 'start' })}>
                Start het potje
              </button>
            )}
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>
              {readyCount}/{game.players.length} klaar
              {isHost && !canStart && ' · minstens 2 spelers nodig'}
            </span>
          </div>
        </div>

        {/* Chat column */}
        <div
          className="parchment"
          style={{ height: 'min(72vh, 640px)', overflow: 'hidden', background: 'linear-gradient(175deg, #31200f, #241505)', border: '1px solid rgba(201,143,61,0.3)' }}
        >
          <Chat messages={messages} viewerId={identity.playerId} onSend={(b) => send({ type: 'chat', body: b })} variant="dark" />
        </div>
      </main>
    </div>
  );
}

function Settings({ game, isHost, send }: { game: GameView; isHost: boolean; send: (m: any) => void }) {
  const update = (patch: Partial<{ targetPoints: number; thinkSeconds: number; dirtyLaundry: boolean }>) => {
    send({
      type: 'settings',
      targetPoints: patch.targetPoints ?? game.targetPoints,
      thinkSeconds: patch.thinkSeconds ?? game.thinkSeconds,
      dirtyLaundry: patch.dirtyLaundry ?? game.dirtyLaundry,
    });
  };

  return (
    <div className="parchment" style={{ padding: '1.4rem', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      <SettingBlock label="Speeldoel">
        {isHost ? (
          <select className="setting-select" value={game.targetPoints} onChange={(e) => update({ targetPoints: Number(e.target.value) })} style={selectStyle}>
            {[5, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n} punten</option>)}
          </select>
        ) : (
          <strong style={{ fontSize: 18 }}>{game.targetPoints} punten</strong>
        )}
      </SettingBlock>
      <SettingBlock label="Bedenktijd">
        {isHost ? (
          <select value={game.thinkSeconds} onChange={(e) => update({ thinkSeconds: Number(e.target.value) })} style={selectStyle}>
            {[20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} sec</option>)}
          </select>
        ) : (
          <strong style={{ fontSize: 18 }}>{game.thinkSeconds} sec</strong>
        )}
      </SettingBlock>
      <SettingBlock label="Vuile was">
        {isHost ? (
          <button className="btn" style={{ padding: '6px 16px', background: game.dirtyLaundry ? 'var(--felt)' : 'var(--parchment-3)', color: game.dirtyLaundry ? '#fff' : 'var(--muted-2)', border: '1px solid var(--cream-line)' }} onClick={() => update({ dirtyLaundry: !game.dirtyLaundry })}>
            {game.dirtyLaundry ? 'Aan' : 'Uit'}
          </button>
        ) : (
          <strong style={{ fontSize: 18 }}>{game.dirtyLaundry ? 'Aan' : 'Uit'}</strong>
        )}
      </SettingBlock>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--cream-line)',
  fontSize: 15,
  background: '#fff',
};

function SettingBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}
