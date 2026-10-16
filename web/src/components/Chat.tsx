import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types.js';

interface Props {
  messages: ChatMessage[];
  viewerId: string | null;
  onSend: (body: string) => void;
  variant?: 'dark' | 'parchment';
}

// "Stamtafel" — the regulars' table chat.
export function Chat({ messages, viewerId, onSend, variant = 'dark' }: Props) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  const dark = variant === 'dark';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderBottom: dark ? '1px solid rgba(201,143,61,0.25)' : '1px solid var(--cream-line)',
        }}
      >
        <span style={{ fontFamily: 'var(--hand)', fontSize: 24, color: 'var(--gold-soft)' }}>
          Stamtafel
        </span>
      </div>

      <div
        ref={listRef}
        className="scrollbar"
        style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {messages.map((m) => {
          if (m.kind === 'system') {
            return (
              <div
                key={m.id}
                style={{
                  textAlign: 'center',
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: dark ? 'var(--gold-soft)' : 'var(--muted-2)',
                  opacity: 0.85,
                }}
              >
                — {m.body} —
              </div>
            );
          }
          const mine = m.player_id === viewerId;
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: dark ? 'var(--gold)' : 'var(--red)',
                  marginBottom: 2,
                }}
              >
                {m.name}
                <span style={{ color: dark ? 'rgba(247,242,230,0.4)' : 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>
                  {new Date(m.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
              <span
                style={{
                  background: mine
                    ? 'linear-gradient(180deg, var(--gold-bright), var(--gold))'
                    : dark
                      ? 'rgba(247,242,230,0.08)'
                      : 'var(--parchment-3)',
                  color: mine ? '#3a2408' : dark ? 'var(--parchment)' : 'var(--ink)',
                  padding: '7px 11px',
                  borderRadius: 12,
                  fontSize: 14,
                  maxWidth: '85%',
                  lineHeight: 1.35,
                }}
              >
                {m.body}
              </span>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div style={{ color: dark ? 'rgba(247,242,230,0.4)' : 'var(--muted)', fontSize: 14, textAlign: 'center', marginTop: 20 }}>
            Nog stil aan tafel…
          </div>
        )}
      </div>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, padding: 12, borderTop: dark ? '1px solid rgba(201,143,61,0.25)' : '1px solid var(--cream-line)' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Zeg iets…"
          maxLength={500}
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: 999,
            border: '1px solid ' + (dark ? 'rgba(247,242,230,0.2)' : 'var(--cream-line)'),
            background: dark ? 'rgba(0,0,0,0.25)' : '#fff',
            color: dark ? 'var(--parchment)' : 'var(--ink)',
            outline: 'none',
            fontSize: 14,
          }}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '0 16px' }}>
          Stuur
        </button>
      </form>
    </div>
  );
}
