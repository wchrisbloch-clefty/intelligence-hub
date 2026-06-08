import { useState, useEffect } from 'react';

export default function useViewport() {
  const snap = () => {
    const w = window.innerWidth;
    return {
      width:     w,
      isPhone:   w < 480,
      isMobile:  w < 768,
      isTablet:  w >= 768 && w < 1024,
      isDesktop: w >= 1024,
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
