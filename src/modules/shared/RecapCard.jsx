// src/modules/shared/RecapCard.jsx — the reader for the scheduled recaps.
//
// The Supabase Edge Functions (supabase/functions/{weekly-recap,monthly-review},
// pg_cron Fri 13:00 UTC / 1st 14:00 UTC) write `weekly_recap_latest` and
// `monthly_review_latest` into the SAME kv table the app reads through
// /api/storage. This mounts on Home (section 'recap') and in Skills → Recaps, so
// the agent never runs into a void.
//
// status: loading | error | empty | ready — rendered via the shared SectionState
// contract. Retry re-fetches ONLY the recaps. Styles: recap-card.css (rc-).
import { useState, useEffect, useCallback } from 'react';
import { storage } from '../../lib/storage';
import MD from './MD';
import { SectionSkeleton, SectionError, SectionEmpty } from './SectionState.jsx';
import './recap-card.css';

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
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setRecaps(null); setFailed(false);
    try {
      const out = await Promise.all(FEEDS.map(async (f) => {
        const r = await storage.get(f.key);
        if (!r?.value) return { ...f, data: null };
        return { ...f, data: typeof r.value === 'string' ? JSON.parse(r.value) : r.value };
      }));
      setRecaps(out);
      // Open on whichever recap actually has content.
      const firstWithBody = out.findIndex((x) => x.data?.content);
      if (firstWithBody > 0) setActive(firstWithBody);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (failed) return <SectionError label="recaps" onRetry={load} />;
  if (!recaps) return <div className="rc" data-status="loading"><SectionSkeleton rows={3} label="recaps" /></div>;

  const current = recaps[active];
  const body = current.data?.content || current.data?.text || current.data?.markdown || '';
  const generated = current.data?.generatedAt || current.data?.createdAt;
  const provider = current.data?.provider;
  const status = body ? 'ready' : 'empty';

  return (
    <div className="rc" data-status={status}>
      <div className="rc-head">
        <div className="rc-tabs" role="tablist">
          {recaps.map((r, i) => (
            <button type="button" key={r.key} role="tab" aria-selected={i === active} className="rc-tab tap"
              onClick={() => { setActive(i); setExpanded(false); }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!body ? (
        <SectionEmpty what={`No ${current.label.toLowerCase()} yet`}
          how={`${current.cadence}. The scheduled agent writes it, then it lands here automatically.`} />
      ) : (
        <>
          <div className="rc-meta">
            <span>{current.cadence}</span>
            {generated && <><span aria-hidden="true">·</span><span>{relTime(generated)}</span></>}
            {provider && <><span aria-hidden="true">·</span><span>via {provider}</span></>}
          </div>
          <div className="rc-body" data-expanded={expanded ? '1' : '0'}>
            <MD text={body} color="var(--accent-text)" />
          </div>
          {body.length > 400 && (
            <button type="button" className="btn rc-more tap" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Collapse' : 'Read the full recap'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
