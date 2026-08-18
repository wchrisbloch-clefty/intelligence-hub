import { useApp } from '../../App.jsx';
import Icon from '../shared/Icon.jsx';

// Blue Ocean opportunity cards. Color restraint: category label + arrow are the
// only tinted marks; borders and the card frame are hairline rules. Tapping a
// card opens the Ask layer pre-loaded with the opportunity.
const SIGNALS = [
  { icon: 'Building2', title: 'Small Multifamily in Transitioning Houston Zips', insight: 'Institutional buyers skip sub-10 unit buildings. AI-driven migration is quietly repricing these before anyone notices.', category: 'Real Estate', urgency: 'HIGH' },
  { icon: 'Cpu', title: 'AI-Augmented BD Professionals', insight: 'First movers who build systematic AI pipelines in BD will have a 10x edge within 18 months. Almost nobody is doing this yet.', category: 'Career Edge', urgency: 'HIGH' },
  { icon: 'TrendingUp', title: 'Covered Calls on Dividend Stacks', insight: 'Systematic covered-call writing on dividend portfolios adds 3–5% yield with no extra capital. Almost no retail investors act on it.', category: 'Finance', urgency: 'MED' },
  { icon: 'Zap', title: 'ERCOT Ancillary Services', insight: 'Texas grid volatility = pricing opportunity in frequency regulation and demand response. Deeply underutilized by non-institutional players.', category: 'Energy/Macro', urgency: 'MED' },
  { icon: 'Activity', title: 'Longevity Biomarkers Protocol', insight: "Attia's Zone 2 + VO₂Max + muscle-mass trifecta: most people optimize none. The compounding return on health at 40+ is asymmetric.", category: 'Longevity', urgency: 'HIGH' },
  { icon: 'Globe', title: 'Onshoring Infrastructure Play', insight: 'Data centers, chip fabs, and LNG terminals being built at scale. The construction supply chain is the overlooked moat.', category: 'Macro', urgency: 'MED' },
];

export default function OpportunityCards() {
  const { isDesktop, setChatPrefill, setChatOpen } = useApp();
  const ask = (s) => { setChatPrefill(`Opportunity: "${s.title}" (${s.category}). ${s.insight}\n\nGiven my goals, how do I take advantage of this? Give me a decisive first move.`); setChatOpen(true); };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 'var(--s3)' }}>
      {SIGNALS.map((s) => (
        <button key={s.title} onClick={() => ask(s)}
          style={{ textAlign: 'left', padding: 'var(--s5)', background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--rule-strong)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--rule)')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: 0.3 }}>
              <Icon name={s.icon} size={16} /> {s.category}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{s.urgency}</span>
          </div>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text)', marginBottom: 8, lineHeight: 'var(--lh-tight)' }}>{s.title}</div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-read)' }}>{s.insight}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 12, fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--accent)' }}>
            Ask about this <Icon name="ArrowRight" size={14} />
          </div>
        </button>
      ))}
    </div>
  );
}
