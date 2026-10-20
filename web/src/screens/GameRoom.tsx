import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ApiError, getGame, joinGame, loadIdentity, saveIdentity } from '../api.js';
import { useGameSocket } from '../useGameSocket.js';
import { useI18n } from '../i18n/index.js';
import { LanguageToggle } from '../i18n/LanguageToggle.js';
import { Lobby } from './Lobby.js';
import { GameTable } from './GameTable.js';
import type { Identity } from '../types.js';

export function GameRoom() {
  const { code = '' } = useParams();
  const [identity, setIdentity] = useState<Identity | null>(() => loadIdentity(code));

  if (!identity) return <JoinGate code={code} onJoined={setIdentity} />;
  return <ConnectedRoom code={code} identity={identity} />;
}

function ConnectedRoom({ code, identity }: { code: string; identity: Identity }) {
  const { t, errorText } = useI18n();
  const gameIdFromCode = code; // server accepts code or id for auth
  const { game, messages, connected, error, send, clearError } = useGameSocket(
    gameIdFromCode,
    identity.playerId,
  );

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 4000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  const banner = error ? (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'max-content',
        maxWidth: '92vw',
        background: 'var(--red)',
        color: '#fff',
        padding: '10px 18px',
        borderRadius: 10,
        zIndex: 1000,
        boxShadow: 'var(--shadow-card)',
        fontWeight: 600,
        textAlign: 'center',
      }}
    >
      {errorText(error.code, error.message)}
    </div>
  ) : null;

  if (!game) {
    return (
      <Centered>
        <div style={{ color: 'var(--parchment)', textAlign: 'center' }}>
          <div className="wordmark" style={{ fontSize: 22 }}>TOEPEN</div>
          <p style={{ marginTop: 12, opacity: 0.7 }}>
            {connected ? t('room.loading') : t('room.connecting')}
          </p>
        </div>
        {banner}
      </Centered>
    );
  }

  const inLobby = game.phase === 'lobby' || game.status === 'lobby';
  return (
    <>
      {banner}
      {inLobby ? (
        <Lobby game={game} messages={messages} identity={identity} send={send} />
      ) : (
        <GameTable game={game} messages={messages} identity={identity} send={send} />
      )}
    </>
  );
}

function JoinGate({ code, onJoined }: { code: string; onJoined: (id: Identity) => void }) {
  const navigate = useNavigate();
  const { t, errorText } = useI18n();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'checking' | 'ready' | 'closed' | 'missing'>('checking');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getGame(code)
      .then((g) => setStatus(g.status === 'lobby' ? 'ready' : 'closed'))
      .catch(() => setStatus('missing'));
  }, [code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await joinGame(code, name.trim());
      const id: Identity = {
        playerId: res.player.id,
        name: res.player.name,
        seat: res.player.seat,
        isHost: false,
      };
      saveIdentity(res.game.code, id);
      onJoined(id);
    } catch (e2) {
      setErr(errorText(e2 instanceof ApiError ? e2.code : null, e2 instanceof Error ? e2.message : null));
      setBusy(false);
    }
  };

  return (
    <Centered>
      <div className="parchment" style={{ padding: '1.8rem', width: 'min(420px, 92vw)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'var(--serif)', fontWeight: 700, letterSpacing: '0.2em', fontSize: 20 }}>TOEPEN</span>
            <span style={{ color: 'var(--gold)' }}>♠♥♣♦</span>
          </div>
          <LanguageToggle compact />
        </div>
        <p style={{ color: 'var(--muted-2)', marginBottom: 6 }}>{t('form.code')}</p>
        <p style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 18 }}>{code.toUpperCase()}</p>

        {status === 'checking' && <p style={{ color: 'var(--muted-2)' }}>{t('gate.checking')}</p>}
        {status === 'missing' && (
          <>
            <p style={{ color: 'var(--red)', marginBottom: 14 }}>{t('gate.missing')}</p>
            <Link to="/" className="btn btn-primary">{t('gate.missing.cta')}</Link>
          </>
        )}
        {status === 'closed' && (
          <>
            <p style={{ color: 'var(--red)', marginBottom: 14 }}>{t('gate.closed')}</p>
            <Link to="/" className="btn btn-primary">{t('gate.closed.cta')}</Link>
          </>
        )}
        {status === 'ready' && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('form.name')}
              maxLength={24}
              style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid var(--cream-line)', fontSize: 16, outline: 'none', width: '100%' }}
            />
            {err && <p style={{ color: 'var(--red)', fontSize: 14 }}>{err}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" style={{ color: 'var(--ink)', border: '1px solid var(--cream-line)' }} onClick={() => navigate('/')}>
                {t('generic.back')}
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !name.trim()}>
                {t('join.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {children}
    </div>
  );
}
