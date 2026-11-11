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
import './source-grounding.css';

const tierKey = (tier) => (tier === 'verified' || tier === 'reported' ? tier : 'inferred');

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
    <span className="sg-chip" data-tier={tierKey(tier)}>
      <Icon name={tier === 'verified' ? 'Check' : tier === 'reported' ? 'BookMarked' : 'Sparkles'} size={11} /> {tier}{note ? ` · ${note}` : ''}
    </span>
  );

  // ── Saved user copy ────────────────────────────────────────────────────────
  if (value?.text && !open) {
    const m = groundingTypeMeta(value.type);
    const lines = value.type === 'toc' ? parseTOC(value.text).length : 0;
    return (
      <div className="sg-box" data-tier={tierKey(m.tier)}>
        <div className="sg-row">
          <span className="sg-row-l">
            <Icon name={m.icon} size={16} className="sg-icon" data-tier={tierKey(m.tier)} />
            <span className="sg-name">Your {m.label.toLowerCase()}{lines ? ` · ${lines} chapters` : ''}</span>
            {chip(m.tier, 'your copy')}
          </span>
          <span className="sg-row-r">
            <button type="button" className="sg-link tap" onClick={startEdit}>Edit</button>
            <button type="button" className="sg-link tap" data-tone="quiet" onClick={() => onClear?.()}>Remove</button>
          </span>
        </div>
        <div className="sg-preview">{value.text.slice(0, 260)}{value.text.length > 260 ? '…' : ''}</div>
      </div>
    );
  }

  // ── Editor (open) ──────────────────────────────────────────────────────────
  if (open) {
    return (
      <div className="sg-box" data-pad="sq">
        <div className="sg-types">
          {types.map((t) => {
            const on = type === t.id;
            return (
              <button type="button" key={t.id} className="sg-type tap" aria-pressed={on} onClick={() => setType(t.id)}>
                <Icon name={t.icon} size={13} /> {t.label}
              </button>
            );
          })}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={meta.placeholder}
          rows={6} autoFocus className="sg-text" aria-label={meta.label || 'Source material'} />
        <div className="sg-foot">
          <span className="sg-foot-note">Tags as {chip(meta.tier, meta.tier === 'verified' ? 'primary source' : 'your account')}</span>
          <span className="sg-spacer" />
          <button type="button" className="sg-link tap" data-tone="muted" onClick={() => { setOpen(false); setText(''); }}>Cancel</button>
          <button type="button" className="sg-btn tap" data-kind="primary" data-size="sm" onClick={save} disabled={!text.trim()}>
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
      <div className="sg-box" data-tier="reported">
        <div className="sg-row">
          <span className="sg-row-l">
            <Icon name="ClipboardList" size={16} className="sg-icon" data-tier="reported" />
            <span className="sg-name">Retrieved table of contents · {chapters.length} chapters</span>
            {chip('reported', retrieved.sourceLabel)}
          </span>
          <button type="button" className="sg-link tap" onClick={startEdit}>Not right? Add your copy</button>
        </div>
        <div className="sg-preview" data-tall="">
          {chapters.slice(0, 8).join(' · ')}{chapters.length > 8 ? ' …' : ''}
        </div>
      </div>
    );
  }

  // ── Searching (automated retrieval in flight) ──────────────────────────────
  if (phase === 'searching' || retrieving) {
    return (
      <div className="sg-searching" aria-live="polite">
        <ThinkingDots color="var(--accent-text)" /> <span>Searching catalogs and the web for the table of contents…</span>
      </div>
    );
  }

  // The attempt log — same pattern as the provider chain, so a miss says what was
  // tried rather than a bare "couldn't verify".
  const attemptLog = attempts.length > 0 && (
    <div className="sg-log">
      <b>Tried:</b>{' '}
      {attempts.map((a, i) => (
        <span key={i}>{i > 0 ? ' · ' : ''}{a.source}{a.detail ? ` (${a.detail})` : ''} → {a.unavailable ? 'unavailable (blocked)' : a.error ? `error ${a.error}` : `${a.results ?? 0} result${a.results === 1 ? '' : 's'}`}</span>
      ))}
    </div>
  );

  // ── Light miss — offer "Search harder" before the manual path appears ──────
  if (phase === 'none') {
    return (
      <div className="sg-box" data-pad="lg">
        <div className="sg-msg">
          Didn’t find a chapter list in a first pass. Let me look harder — more editions, the publisher’s own page, and the author’s site.
        </div>
        <div className="sg-actions">
          <button type="button" className="sg-btn tap" data-kind="primary" onClick={() => onSearchHarder?.()}>
            <Icon name="Search" size={14} /> Search harder
          </button>
          <button type="button" className="sg-link tap" data-tone="quiet" onClick={startEdit}>or paste it yourself</button>
        </div>
        {attemptLog}
      </div>
    );
  }

  // ── Deep miss — the manual path, reframed as the exception it is ───────────
  if (phase === 'deep-none') {
    return (
      <div className="sg-box" data-pad="lg" data-tier="inferred">
        <div className="sg-msg">
          Couldn’t find a chapter list for this one. If you have a copy, you can paste the contents — that gives the strongest possible grounding (a <b>verified</b> primary source with real chapter locations).
        </div>
        <button type="button" className="sg-btn tap" data-kind="primary" onClick={startEdit}>
          <Icon name="BookMarked" size={14} /> {label}
        </button>
        {attemptLog}
      </div>
    );
  }

  // ── Idle — no retrieval attempted yet (e.g. a book the model already knows) ──
  return (
    <div className="sg-actions">
      {retrievable && (
        <button type="button" className="sg-btn tap" data-kind="outline" data-size="sm" onClick={() => onRetrieve?.()}>
          <Icon name="Search" size={14} /> Find the table of contents
        </button>
      )}
      <button type="button" className="sg-btn tap" data-kind="ghost" data-size="sm" onClick={startEdit}>
        <Icon name="BookMarked" size={14} /> {label}
      </button>
    </div>
  );
}
