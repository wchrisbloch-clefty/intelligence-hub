import { useState, useEffect } from 'react';

export default function useViewport() {
  const snap = () => {
    const w = window.innerWidth;
    return {
      width:     w,
      // Boundaries match docs/RESPONSIVE.md + src/styles/tokens.css:
      // mobile ≤720 · iPad 721–1100 · desktop ≥1101. Prefer CSS media
      // queries for LAYOUT; these flags are for behaviour only.
      isPhone:   w < 480,
      isMobile:  w <= 720,
      isTablet:  w > 720 && w <= 1100,
      isDesktop: w > 1100,
      isWide:    w >= 1280,
    };
  };
  const [vp, setVp] = useState(snap);
  useEffect(() => {
    const fn = () => setVp(snap());
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return vp;
}
