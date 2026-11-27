// src/modules/shared/PageWithRail.jsx — the contract's third column, for real
// (Batch Z-2 / J2). docs/RESPONSIVE.md promises "desktop ≥1101: sidebar + main +
// 340px rail"; until now no module rendered one, so the three-column layout was
// described, not done. This is the one place the rail is laid out:
//   ≥1101  main | rail (var(--rail-width) = 340px), rail sticky
//   <1101  rail stacks BELOW main (the contract: "rail moves below" on iPad/phone)
// Sized in CSS only.
import './page-with-rail.css';

export default function PageWithRail({ children, rail, label = 'Related' }) {
  return (
    <div className="pwr">
      <div className="pwr-main">{children}</div>
      {rail && <aside className="pwr-rail" aria-label={label}>{rail}</aside>}
    </div>
  );
}
