import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame, joinGame, saveIdentity } from '../api.js';

type Mode = null | 'create' | 'join';

export function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(null);

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 6vw',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="wordmark" style={{ fontSize: 26 }}>
            TOEPEN
          </span>
          <span className="suits" style={{ fontSize: 18 }}>
            ♠♥♣♦
          </span>
        </div>
        <nav style={{ display: 'flex', gap: 24, color: 'var(--parchment)', fontWeight: 600, opacity: 0.85, fontSize: 15 }}>
          <span style={{ cursor: 'default' }}>Spelregels</span>
          <span style={{ cursor: 'default' }}>Ranglijst</span>
        </nav>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '2rem 6vw 4rem',
        }}
      >
        <span style={{ fontFamily: 'var(--hand)', fontSize: 30, color: 'var(--gold-soft)', marginBottom: 4 }}>
          Zoals vroeger aan de stamtafel
        </span>
        <h1
          style={{
            fontFamily: 'var(--serif)',
            color: 'var(--parchment)',
            fontSize: 'clamp(2.4rem, 6vw, 4.2rem)',
            lineHeight: 1.05,
            margin: '0.4rem 0',
            maxWidth: 900,
          }}
        >
          Het café-kaartspel,
          <br />
          <span style={{ color: 'var(--gold)' }}>nu met je vrienden online.</span>
        </h1>
        <p style={{ color: 'var(--parchment)', opacity: 0.8, fontSize: 18, maxWidth: 620, margin: '1rem 0 2rem', lineHeight: 1.5 }}>
          Bluf, toep en vouw. Vier kaarten, vijftien punten, en één iemand haalt vanavond de volgende ronde.
        </p>

        {!mode && (
          <>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn-primary" style={{ fontSize: 18, padding: '1rem 2rem' }} onClick={() => setMode('create')}>
                Potje aanmaken
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 18, padding: '1rem 2rem' }} onClick={() => setMode('join')}>
                Meedoen
              </button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 18 }}>
              Gratis · 2–8 spelers · geen account nodig om mee te doen
            </p>
          </>
        )}

        {mode === 'create' && <CreateForm onBack={() => setMode(null)} onDone={(code, id) => go(navigate, code, id)} />}
        {mode === 'join' && <JoinForm onBack={() => setMode(null)} onDone={(code, id) => go(navigate, code, id)} />}
      </main>

      <section style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', padding: '0 6vw 4rem' }}>
        <Feature title="Maak een tafel" body="Kies het aantal punten en deel de spelcode." />
        <Feature title="Nodig je maten uit" body="Iedereen doet mee via de code — zonder gedoe." />
        <Feature title="Toep of vouw" body="Verhoog de inzet en bluf je tegenstanders eruit." />
      </section>
    </div>
  );
}

function go(navigate: ReturnType<typeof useNavigate>, code: string, _id: string) {
  navigate(`/game/${code}`);
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="parchment" style={{ padding: '1.3rem 1.5rem', maxWidth: 280, textAlign: 'left' }}>
      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 20, marginBottom: 6, color: 'var(--ink)' }}>{title}</h3>
      <p style={{ color: 'var(--muted-2)', fontSize: 15, lineHeight: 1.45 }}>{body}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid var(--cream-line)',
  fontSize: 16,
  background: '#fff',
  color: 'var(--ink)',
  outline: 'none',
};

function CreateForm({ onBack, onDone }: { onBack: () => void; onDone: (code: string, id: string) => void }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState(15);
  const [think, setThink] = useState(30);
  const [dirty, setDirty] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await createGame({ name: name.trim(), targetPoints: target, thinkSeconds: think, dirtyLaundry: dirty });
      saveIdentity(res.game.code, {
        playerId: res.player.id,
        name: res.player.name,
        seat: res.player.seat,
        isHost: true,
      });
      onDone(res.game.code, res.player.id);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Er ging iets mis');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="parchment" style={{ padding: '1.6rem', width: 'min(420px, 92vw)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>Maak een tafel</h2>
      <Field label="Jouw naam">
        <input autoFocus style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Jeroen" maxLength={24} />
      </Field>
      <div style={{ display: 'flex', gap: 12 }}>
        <Field label="Speeldoel (punten)">
          <select style={inputStyle} value={target} onChange={(e) => setTarget(Number(e.target.value))}>
            {[5, 8, 10, 12, 15].map((n) => (
              <option key={n} value={n}>{n} punten</option>
            ))}
          </select>
        </Field>
        <Field label="Bedenktijd">
          <select style={inputStyle} value={think} onChange={(e) => setThink(Number(e.target.value))}>
            {[20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>{n} sec</option>
            ))}
          </select>
        </Field>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={dirty} onChange={(e) => setDirty(e.target.checked)} style={{ width: 18, height: 18 }} />
        <span style={{ fontWeight: 600 }}>Vuile was toegestaan</span>
      </label>
      {err && <p style={{ color: 'var(--red)', fontSize: 14 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" className="btn btn-ghost" style={{ color: 'var(--ink)', border: '1px solid var(--cream-line)' }} onClick={onBack}>
          Terug
        </button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !name.trim()}>
          {busy ? 'Even geduld…' : 'Tafel openen'}
        </button>
      </div>
    </form>
  );
}

function JoinForm({ onBack, onDone }: { onBack: () => void; onDone: (code: string, id: string) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await joinGame(code.trim().toUpperCase(), name.trim());
      saveIdentity(res.game.code, {
        playerId: res.player.id,
        name: res.player.name,
        seat: res.player.seat,
        isHost: false,
      });
      onDone(res.game.code, res.player.id);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Er ging iets mis');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="parchment" style={{ padding: '1.6rem', width: 'min(420px, 92vw)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>Meedoen aan een potje</h2>
      <Field label="Spelcode">
        <input autoFocus style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="KLAVER-712" />
      </Field>
      <Field label="Jouw naam">
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Sanne" maxLength={24} />
      </Field>
      {err && <p style={{ color: 'var(--red)', fontSize: 14 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" className="btn btn-ghost" style={{ color: 'var(--ink)', border: '1px solid var(--cream-line)' }} onClick={onBack}>
          Terug
        </button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !name.trim() || !code.trim()}>
          {busy ? 'Even geduld…' : 'Aanschuiven'}
        </button>
      </div>
    </form>
  );
}
