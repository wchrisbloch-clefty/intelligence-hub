import { useApp } from '../App.jsx';
import RecapCard from './shared/RecapCard.jsx';

// Recaps — a mode inside the Skills container. The weekly-recap / monthly-review
// Edge Functions still write weekly_recap_latest / monthly_review_latest;
// RecapCard reads them. Moved off Home so the dashboard stays lean.
export default function Recaps() {
  const { isMobile, isPhone } = useApp();
  const pad = isPhone ? '14px' : isMobile ? '16px' : '28px';
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: `20px ${pad} 80px` }}>
      <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Practice</div>
      <div style={{ fontSize: isMobile ? 'var(--fs-2xl)' : 'var(--fs-3xl)', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)', letterSpacing: -0.5, lineHeight: 'var(--lh-tight)' }}>Recaps</div>
      <div style={{ fontSize: 'var(--fs-base)', color: 'var(--text-secondary)', margin: '6px 0 20px' }}>Your Friday recap and monthly review, generated automatically.</div>
      <RecapCard />
    </div>
  );
}
