// src/modules/shared/SourceGrounding.jsx — the shared "I have this" input for
// any surface where the user holds source material the model can't retrieve (a
// post-cutoff book's table of contents, a talk transcript, private notes).
//
// It renders three things, in priority order: a user-supplied copy (authoritative,
// tiered by type), an automatically-retrieved TOC (reported), or a call to add
// one. Generalised — BookClub, DeepDive, TEDHub and PodcastHub all mount it; the
// owning surface persists `value` and injects it into its generation prompt.
//
// Phone-first: this is where someone holding a physical book will actually type,
// so the textarea and controls stay usable at 390px. Theme tokens only, `--fs-*`
// scale, Icon registry — no hardcoded hex or font sizes.
import { useState } from 'react';
import Icon from './Icon.jsx';
import { USER_GROUNDING_TYPES, groundingTypeMeta, parseTOC } from '../../lib/sourceGrounding.js';
import { ThinkingDots } from './Common.jsx';

const tierColor = (tier) => tier === 'verified' ? 'var(--tier-verified)' : tier === 'reported' ? 'var(--tier-reported)' : 'var(--tier-inferred)';

export default function SourceGrounding({
  value,                 // current userGrounding { type, text, source, addedAt } | null
  retrieved,             // retrieved TOC { toc, source, sourceLabel } | null
  onSave,                // (userGrounding) => void  — persist a user copy
  onClear,               // () => void               — remove the user copy
  onRetrieve,            // async () => void          — run the automated chain (books)
  onSearchHarder,        // async () => void          — deeper multi-source retry
  retrievable = false,   // show the "Try automatic retrieval" control (idle)
  retrieving = false,    // retrieval in flight
  phase = 'idle',        // idle | searching | found | none (light miss) | deep-none
  attempts = [],         // per-source attempt log to report on a miss
  prompt = '',           // an emphasised CTA (legacy; phase drives the copy now)
  types = USER_GROUNDING_TYPES,
  label = 'I have this — add source material',
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(types[0]?.id || 'toc');
  const [text, setText] = useState('');

  const meta = groundingTypeMeta(type);
  const startEdit = () => { setType(value?.type || types[0]?.id || 'toc'); setText(value?.text || ''); setOpen(true); };
  const save = () => {
    const t = text.trim();
    if (!t) return;
    onSave?.({ type, text: t, source: 'user', addedAt: Date.now() });
    setOpen(false); setText('');
  };

  const chip = (tier, note) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: tierColor(tier), border: `1px solid ${tierColor(tier)}`, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>
      <Icon name={tier === 'verified' ? 'Check' : tier === 'reported' ? 'BookMarked' : 'Sparkles'} size={11} /> {tier}{note ? ` · ${note}` : ''}
    </span>
  );

  // ── Saved user copy ────────────────────────────────────────────────────────
  if (value?.text && !open) {
    const m = groundingTypeMeta(value.type);
    const lines = value.type === 'toc' ? parseTOC(value.text).length : 0;
    return (
      <div style={{ padding: '12px 14px', border: `1px solid ${tierColor(m.tier)}`, borderRadius: 12, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
            <Icon name={m.icon} size={16} style={{ color: tierColor(m.tier) }} />
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)' }}>Your {m.label.toLowerCase()}{lines ? ` · ${lines} chapters` : ''}</span>
            {chip(m.tier, 'your copy')}
          </span>
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <button onClick={startEdit} style={linkBtn}>Edit</button>
            <button onClick={() => onClear?.()} style={{ ...linkBtn, color: 'var(--text-tertiary)' }}>Remove</button>
          </span>
        </div>
        <div style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-read)', maxHeight: 66, overflow: 'hidden', whiteSpace: 'pre-wrap' }}>{value.text.slice(0, 260)}{value.text.length > 260 ? '…' : ''}</div>
      </div>
    );
  }

  // ── Editor (open) ──────────────────────────────────────────────────────────
  if (open) {
    return (
      <div style={{ padding: '14px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {types.map((t) => {
            const on = type === t.id;
            return (
              <button key={t.id} onClick={() => setType(t.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-glow)' : 'transparent', color: on ? 'var(--accent)' : 'var(--muted)', fontSize: 'var(--fs-sm)', fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', minHeight: 34 }}>
                <Icon name={t.icon} size={13} /> {t.label}
              </button>
            );
          })}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={meta.placeholder}
          rows={6} autoFocus
          style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 'var(--fs-base)', lineHeight: 'var(--lh-read)', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>Tags as {chip(meta.tier, meta.tier === 'verified' ? 'primary source' : 'your account')}</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => { setOpen(false); setText(''); }} style={{ ...linkBtn, color: 'var(--muted)' }}>Cancel</button>
          <button onClick={save} disabled={!text.trim()}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: text.trim() ? 'var(--accent)' : 'var(--surf2)', color: text.trim() ? 'var(--on-accent)' : 'var(--dim)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: text.trim() ? 'pointer' : 'default', fontFamily: 'inherit', minHeight: 36 }}>
            Save source
          </button>
        </div>
      </div>
    );
  }

  // ── Retrieved TOC preview (no user copy yet) ───────────────────────────────
  if (retrieved?.toc) {
    const chapters = parseTOC(retrieved.toc);
    return (
      <div style={{ padding: '12px 14px', border: '1px solid var(--tier-reported)', borderRadius: 12, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            <Icon name="ClipboardList" size={16} style={{ color: 'var(--tier-reported)' }} />
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text)' }}>Retrieved table of contents · {chapters.length} chapters</span>
            {chip('reported', retrieved.sourceLabel)}
          </span>
          <button onClick={startEdit} style={linkBtn}>Not right? Add your copy</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-read)', maxHeight: 88, overflow: 'hidden' }}>
          {chapters.slice(0, 8).join(' · ')}{chapters.length > 8 ? ' …' : ''}
        </div>
      </div>
    );
  }

  // ── Searching (automated retrieval in flight) ──────────────────────────────
  if (phase === 'searching' || retrieving) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
        <ThinkingDots color="var(--accent)" /> <span style={{ minWidth: 0 }}>Searching catalogs and the web for the table of contents…</span>
      </div>
    );
  }

  // The attempt log — same pattern as the provider chain, so a miss says what was
  // tried rather than a bare "couldn't verify".
  const attemptLog = attempts.length > 0 && (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--rule)', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', overflowWrap: 'anywhere', lineHeight: 'var(--lh-read)' }}>
      <span style={{ fontWeight: 700 }}>Tried:</span>{' '}
      {attempts.map((a, i) => (
        <span key={i}>{i > 0 ? ' · ' : ''}{a.source}{a.detail ? ` (${a.detail})` : ''} → {a.error ? `error ${a.error}` : `${a.results ?? 0} result${a.results === 1 ? '' : 's'}`}</span>
      ))}
    </div>
  );

  // ── Light miss — offer "Search harder" before the manual path appears ──────
  if (phase === 'none') {
    return (
      <div style={{ padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-read)', marginBottom: 10 }}>
          Didn’t find a chapter list in a first pass. Let me look harder — more editions, the publisher’s own page, and the author’s site.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => onSearchHarder?.()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 }}>
            <Icon name="Search" size={14} /> Search harder
          </button>
          <button onClick={startEdit} style={{ ...linkBtn, color: 'var(--text-tertiary)' }}>or paste it yourself</button>
        </div>
        {attemptLog}
      </div>
    );
  }

  // ── Deep miss — the manual path, reframed as the exception it is ───────────
  if (phase === 'deep-none') {
    return (
      <div style={{ padding: '14px 16px', border: '1px solid var(--tier-inferred)', borderRadius: 12, background: 'var(--surface)' }}>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-read)', marginBottom: 10 }}>
          Couldn’t find a chapter list for this one. If you have a copy, you can paste the contents — that gives the strongest possible grounding (a <b>verified</b> primary source with real chapter locations).
        </div>
        <button onClick={startEdit}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 }}>
          <Icon name="BookMarked" size={14} /> {label}
        </button>
        {attemptLog}
      </div>
    );
  }

  // ── Idle — no retrieval attempted yet (e.g. a book the model already knows) ──
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {retrievable && (
        <button onClick={() => onRetrieve?.()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 }}>
          <Icon name="Search" size={14} /> Find the table of contents
        </button>
      )}
      <button onClick={startEdit}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36 }}>
        <Icon name="BookMarked" size={14} /> {label}
      </button>
    </div>
  );
}

const linkBtn = { background: 'none', border: 'none', color: 'var(--accent)', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 };
