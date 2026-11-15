import { useState, useEffect } from 'react';
import { getFeed, fmtCount, PLATFORM_META, TIER_META } from '../../lib/adapters.js';
import { SectionSkeleton, SectionError } from '../shared/SectionState.jsx';

// Live signal feed — YouTube via the live adapter, others manual. Tier is the
// only grading mark (text + 1px bar, never a fill); the card frame is a hairline.
// status: loading | error | empty | ready. Styles: home.css.
export default function SignalFeed() {
  const [feed, setFeed] = useState([]);
  const [status, setStatus] = useState('loading');

  const load = async () => {
    setStatus('loading');
    try { const f = await getFeed({ limit: 8 }); setFeed(f || []); setStatus(f?.length ? 'ready' : 'empty'); }
    catch { setFeed([]); setStatus('error'); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (status === 'loading') return <SectionSkeleton rows={3} label="signals" />;
  if (status === 'error') return <SectionError label="signals" onRetry={load} />;
  if (status === 'empty') return (
    <div className="hm-empty" data-status="empty">
      No live signals right now. YouTube videos appear here once <code>YOUTUBE_API_KEY</code> is set in Vercel — other platforms are curated manually.
    </div>
  );

  return (
    <div className="hm-feed" data-status="ready">
      {feed.map((s) => {
        const meta = PLATFORM_META[s.platform] || {};
        const tier = TIER_META[s.tier] || TIER_META.unranked;
        return (
          <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="hm-sig">
            <span className="hm-sig-meta">
              <span>{meta.label || s.platform}</span>
              <span className="hm-tier" style={{ '--tier': `var(--tier-${s.tier || 'uncited'})` }}>{tier.label}</span>
              {s.status === 'live' && <span className="hm-live">LIVE</span>}
            </span>
            <span className="hm-sig-title">{s.title}</span>
            <span className="hm-sig-foot">
              <span className="hm-sig-src">{s.source}</span>
              <span>· {fmtCount(s.views)} views</span>
              {s.relTime && <span>· {s.relTime}</span>}
            </span>
          </a>
        );
      })}
    </div>
  );
}
