// src/modules/shared/RecapCard.jsx
//
// The recap functions write `weekly_recap_latest` and `monthly_review_latest`
// and nothing reads them. This is the reader. Without it the agent runs every
// Friday into a void.
//
// Mount on Home:
//   import RecapCard from './shared/RecapCard';
//   <RecapCard />

import { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import MD from './MD';

const FEEDS = [
  { key: 'weekly_recap_latest',   label: 'Friday recap',   cadence: 'Weekly · Fridays' },
  { key: 'monthly_review_latest', label: 'Monthly review', cadence: 'Monthly · the 1st' },
];

function relTime(ts) {
  if (!ts) return null;
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export default function RecapCard() {
  const [recaps, setRecaps] = useState(null);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = await Promise.all(
        FEEDS.map(async (f) => {
          try {
            const r = await storage.get(f.key);
            if (!r?.value) return { ...f, data: null };
            const parsed = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
            return { ...f, data: parsed };
          } catch {
            return { ...f, data: null };
          }
        })
      );
      if (!cancelled) setRecaps(out);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!recaps) {
    return (
      <div style={S.card}>
        <div style={S.eyebrow}>Recaps</div>
        <div style={{ ...S.empty, color: 'var(--dim)' }}>Loading…</div>
      </div>
    );
  }

  const current = recaps[active];
  const body = current.data?.content || current.data?.text || current.data?.markdown || '';
  const generated = current.data?.generatedAt || current.data?.createdAt;
  const provider = current.data?.provider;

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div style={S.eyebrow}>Recaps</div>
        <div style={S.tabs}>
          {recaps.map((r, i) => (
            <button
              key={r.key}
              onClick={() => { setActive(i); setExpanded(false); }}
              style={{
                ...S.tab,
                color: i === active ? 'var(--accent)' : 'var(--dim)',
                borderColor: i === active ? 'var(--accent)' : 'transparent',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!body ? (
        // An empty state is direction, not an apology. Say what's missing and
        // what produces it.
        <div style={S.empty}>
          <div style={{ color: 'var(--text-b)', marginBottom: 6 }}>
            No {current.label.toLowerCase()} yet.
          </div>
          <div style={{ color: 'var(--dim)', fontSize: 12, lineHeight: 1.6 }}>
            {current.cadence}. The first one generates on the next scheduled run,
            then lands here automatically.
          </div>
        </div>
      ) : (
        <>
          <div style={S.meta}>
            <span>{current.cadence}</span>
            {generated && (
              <>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span>{relTime(generated)}</span>
              </>
            )}
            {provider && (
              <>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span style={{ color: 'var(--text-tertiary)' }}>via {provider}</span>
              </>
            )}
          </div>

          <div style={{ ...S.body, maxHeight: expanded ? 'none' : 220, overflow: 'hidden' }}>
            <MD text={body} color="var(--accent)" />
          </div>

          {!expanded && body.length > 400 && (
            <div style={S.fade}>
              <button onClick={() => setExpanded(true)} style={S.more}>
                Read the full recap
              </button>
            </div>
          )}
          {expanded && (
            <button onClick={() => setExpanded(false)} style={{ ...S.more, marginTop: 12 }}>
              Collapse
            </button>
          )}
        </>
      )}
    </div>
  );
}

const S = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 20,
    boxShadow: 'var(--shadow-sm)',
    position: 'relative',
  },
  head: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, flexWrap: 'wrap', marginBottom: 12,
  },
  eyebrow: {
    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--dim)',
  },
  tabs: { display: 'flex', gap: 4 },
  tab: {
    background: 'transparent', border: 'none', borderBottom: '2px solid transparent',
    padding: '4px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit', transition: 'color 120ms ease',
  },
  meta: {
    display: 'flex', gap: 6, alignItems: 'center',
    fontSize: 11, color: 'var(--dim)', marginBottom: 12,
  },
  body: { position: 'relative', fontSize: 14, lineHeight: 1.65 },
  empty: { padding: '20px 0 4px', fontSize: 13 },
  fade: {
    position: 'absolute', left: 20, right: 20, bottom: 16,
    paddingTop: 40,
    background: 'linear-gradient(transparent, var(--surface) 55%)',
    display: 'flex', justifyContent: 'center',
  },
  more: {
    background: 'transparent', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '6px 14px',
    color: 'var(--accent)', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
};
