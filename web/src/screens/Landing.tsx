import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, createGame, joinGame, saveIdentity } from '../api.js';
import { useI18n, useT } from '../i18n/index.js';
import { SiteHeader } from '../components/SiteHeader.js';

type Mode = null | 'create' | 'join';

export function Landing() {
  const navigate = useNavigate();
  const t = useT();
  const [mode, setMode] = useState<Mode>(null);

  return (
    <div className="page">
      <SiteHeader />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '2rem clamp(16px, 6vw, 72px) 4rem',
        }}
      >
        <span style={{ fontFamily: 'var(--hand)', fontSize: 'clamp(22px, 6vw, 30px)', color: 'var(--gold-soft)', marginBottom: 4 }}>
          {t('landing.kicker')}
        </span>
        <h1
          style={{
            fontFamily: 'var(--serif)',
            color: 'var(--parchment)',
            fontSize: 'clamp(2.1rem, 6vw, 4.2rem)',
            lineHeight: 1.05,
            margin: '0.4rem 0',
            maxWidth: 900,
          }}
        >
          {t('landing.title.1')}
          <br />
          <span style={{ color: 'var(--gold)' }}>{t('landing.title.2')}</span>
        </h1>
        <p style={{ color: 'var(--parchment)', opacity: 0.8, fontSize: 'clamp(15px, 4vw, 18px)', maxWidth: 620, margin: '1rem 0 2rem', lineHeight: 1.5 }}>
          {t('landing.body')}
        </p>

        {!mode && (
          <>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn-primary" style={{ fontSize: 18, padding: '1rem 2rem' }} onClick={() => setMode('create')}>
                {t('landing.create')}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 18, padding: '1rem 2rem' }} onClick={() => setMode('join')}>
                {t('landing.join')}
              </button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 18 }}>{t('landing.note')}</p>
          </>
        )}

        {mode === 'create' && <CreateForm onBack={() => setMode(null)} onDone={(code) => navigate(`/game/${code}`)} />}
        {mode === 'join' && <JoinForm onBack={() => setMode(null)} onDone={(code) => navigate(`/game/${code}`)} />}
      </main>

      <section style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', padding: '0 clamp(16px, 6vw, 72px) 4rem' }}>
        <Feature title={t('landing.feature.1.title')} body={t('landing.feature.1.body')} />
        <Feature title={t('landing.feature.2.title')} body={t('landing.feature.2.body')} />
        <Feature title={t('landing.feature.3.title')} body={t('landing.feature.3.body')} />
      </section>
    </div>
  );
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
  fontSize: 16, // 16px or more, or iOS Safari zooms the page on focus
  background: '#fff',
  color: 'var(--ink)',
  outline: 'none',
  width: '100%',
};

const formStyle: React.CSSProperties = {
  padding: '1.6rem',
  width: 'min(420px, 92vw)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

/** Whatever went wrong, said in the player's language. */
function useFailureText(): (e: unknown) => string {
  const { errorText } = useI18n();
  return (e: unknown) =>
    errorText(e instanceof ApiError ? e.code : null, e instanceof Error ? e.message : null);
}

function CreateForm({ onBack, onDone }: { onBack: () => void; onDone: (code: string) => void }) {
  const t = useT();
  const failure = useFailureText();
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
      onDone(res.game.code);
    } catch (e2) {
      setErr(failure(e2));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="parchment" style={formStyle}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>{t('create.title')}</h2>
      <Field label={t('form.name')}>
        <input autoFocus style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('form.name.placeholder.create')} maxLength={24} />
      </Field>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px' }}>
          <Field label={t('form.target')}>
            <select style={inputStyle} value={target} onChange={(e) => setTarget(Number(e.target.value))}>
              {[5, 8, 10, 12, 15].map((n) => (
                <option key={n} value={n}>{t('form.points', { n })}</option>
              ))}
            </select>
          </Field>
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <Field label={t('form.think')}>
            <select style={inputStyle} value={think} onChange={(e) => setThink(Number(e.target.value))}>
              {[20, 30, 45, 60].map((n) => (
                <option key={n} value={n}>{t('form.seconds', { n })}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={dirty} onChange={(e) => setDirty(e.target.checked)} style={{ width: 18, height: 18 }} />
        <span style={{ fontWeight: 600 }}>{t('create.dirty')}</span>
      </label>
      {err && <p style={{ color: 'var(--red)', fontSize: 14 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" className="btn btn-ghost" style={{ color: 'var(--ink)', border: '1px solid var(--cream-line)' }} onClick={onBack}>
          {t('generic.back')}
        </button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !name.trim()}>
          {busy ? t('generic.busy') : t('create.submit')}
        </button>
      </div>
    </form>
  );
}

function JoinForm({ onBack, onDone }: { onBack: () => void; onDone: (code: string) => void }) {
  const t = useT();
  const failure = useFailureText();
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
      onDone(res.game.code);
    } catch (e2) {
      setErr(failure(e2));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="parchment" style={formStyle}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>{t('join.title')}</h2>
      <Field label={t('form.code')}>
        <input
          autoFocus
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          style={{ ...inputStyle, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="KLAVER-712"
        />
      </Field>
      <Field label={t('form.name')}>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('form.name.placeholder.join')} maxLength={24} />
      </Field>
      {err && <p style={{ color: 'var(--red)', fontSize: 14 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" className="btn btn-ghost" style={{ color: 'var(--ink)', border: '1px solid var(--cream-line)' }} onClick={onBack}>
          {t('generic.back')}
        </button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !name.trim() || !code.trim()}>
          {busy ? t('generic.busy') : t('join.submit')}
        </button>
      </div>
    </form>
  );
}
