import { useState, useEffect } from 'react';
import Icon from '../shared/Icon.jsx';
import { ThinkingDots } from '../shared/Common.jsx';
import { getFeed, fmtCount, PLATFORM_META, TIER_META } from '../../lib/adapters.js';

// Live signal feed — YouTube via the live adapter, others manual. Tier chip is
// the only grading mark (existing --tier-* tokens); the card frame is a hairline.
export default function SignalFeed() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => { setLoading(true); try { setFeed(await getFeed({ limit: 8 })); } catch { setFeed([]); } setLoading(false); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (loading) return <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--rule)', textAlign: 'center' }}><ThinkingDots /></div>;
  if (feed.length === 0) return (
    <div style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 10, border: '1px dashed var(--rule)', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-read)' }}>
      No live signals right now. YouTube videos appear here once <code style={{ color: 'var(--text)' }}>YOUTUBE_API_KEY</code> is set in Vercel — other platforms are curated manually.
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
      {feed.map((s) => {
        const meta = PLATFORM_META[s.platform] || {};
        const tier = TIER_META[s.tier] || TIER_META.unranked;
        const live = s.status === 'live';
        return (
          <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', textDecoration: 'none', padding: '13px 15px', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 10, transition: 'border-color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--rule-strong)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-tertiary)' }}>{meta.label || s.platform}</span>
              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: `var(--tier-${s.tier || 'uncited'})`, border: `1px solid color-mix(in srgb, var(--tier-${s.tier || 'uncited'}) 40%, transparent)`, padding: '1px 6px', borderRadius: 3 }}>{tier.label}</span>
              {live && <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, color: 'var(--positive)' }}>● LIVE</span>}
            </div>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text)', lineHeight: 'var(--lh-tight)', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%' }}>{s.source}</span>
              <span>· {fmtCount(s.views)} views</span>
              {s.relTime && <span>· {s.relTime}</span>}
            </div>
          </a>
        );
      })}
    </div>
  );
}
