import RecapCard from './shared/RecapCard.jsx';
import './recaps.css';

// Recaps — a mode inside the Skills container. The weekly-recap / monthly-review
// Edge Functions still write weekly_recap_latest / monthly_review_latest;
// RecapCard reads them. Moved off Home so the dashboard stays lean.
export default function Recaps() {
  return (
    <div className="rcp">
      <div className="rcp-eyebrow">Practice</div>
      <div className="rcp-title">Recaps</div>
      <div className="rcp-lede">Your Friday recap and monthly review, generated automatically.</div>
      <RecapCard />
    </div>
  );
}
